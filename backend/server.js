require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require('axios')

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const authRoutes = require('./routes/auth');

app.use('/api/auth', authRoutes);
app.use(express.json());

// เชื่อมต่อ MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error("❌ Database Connection Failed!", err);
    } else {
        console.log("✅ Connected to MySQL Database");
    }
});

// ช่วยให้ใช้ async/await กับ MySQL ได้สะดวก
const util = require('util');
db.queryAsync = util.promisify(db.query).bind(db);

// ตัวช่วยตอบ error เดียวกันหมด
function sendDbError(res, err, where='') {
  console.error(`❌ DB error @${where}:`, err);
  res.status(500).json({ error: 'Database error', detail: err?.sqlMessage || String(err) });
}


// GET: ดึงข้อมูลสินค้า
app.get("/products", (req, res) => {
    db.query("SELECT * FROM Product", (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results);
        }
    });
});

// POST: เพิ่มสินค้าใหม่
app.post('/products', (req, res) => {
    const { Name, Category, Description, BeaconId } = req.body;
  
    // if (!Name || !Category || !BeaconId) {
    //   return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    // }
  
    const insertProduct = 'INSERT INTO Product (Name, Category, Description) VALUES (?, ?, ?)';
    db.query(insertProduct, [Name, Category, Description], (err, result) => {
      if (err) return res.status(500).json({ error: 'บันทึกสินค้าไม่สำเร็จ' });
  
      const productId = result.insertId;
  
      const insertRelation = 'INSERT INTO product_beacon (productId, beaconId) VALUES (?, ?)';
      db.query(insertRelation, [productId, BeaconId], (err2, result2) => {
        if (err2) return res.status(500).json({ error: 'บันทึกข้อมูล beacon ไม่สำเร็จ' });
  
        res.json({ success: true, productId, beaconRelationId: result2.insertId });
      });
    });
});

// PUT: แก้ไขสินค้า
app.put('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const { Name, Category, Description } = req.body || {};

  // สร้าง SQL dynamic เฉพาะฟิลด์ที่มีส่งมา และไม่ใช่ค่าว่าง
  const fields = [];
  const values = [];

  function addField(col, val) {
    if (val !== undefined) { // ส่งมาใน body
      fields.push(`${col} = IFNULL(NULLIF(?, ''), ${col})`); // '' จะถูกตีความเป็น NO-UPDATE
      values.push(val);
    }
  }

  addField('Name', Name);
  addField('Category', Category);
  addField('Description', Description);

  if (fields.length === 0) return res.json({ updated: 0, note: 'no-change' });

  const sql = `UPDATE product SET ${fields.join(', ')} WHERE ProductID = ?`;
  values.push(id);

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ Update error:', err);
      return res.status(500).json({ error: 'Database error', detail: err.sqlMessage });
    }
    res.json({ updated: result.affectedRows });
  });
});


// DELETE: ลบสินค้า
app.delete("/api/products/:id", (req, res) => {
    const productID = req.params.id;
    db.query("DELETE FROM Product WHERE ProductID = ?", [productID], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json({ message: "✅ ลบสินค้าสำเร็จ" });
        }
    });
});


// API สำหรับเพิ่มข้อมูล PositionRecord
app.post("/position", (req, res) => {
  const b = req.body || {};
  const slot = +b.slot;
  const collect = +b.collect;
  // อนุญาตให้เป็น null ถ้าไม่ได้ส่งมา
  const r1 = (typeof b.RSSI_1 === "number") ? b.RSSI_1 : null;
  const r2 = (typeof b.RSSI_2 === "number") ? b.RSSI_2 : null;
  const r3 = (typeof b.RSSI_3 === "number") ? b.RSSI_3 : null;

  if (!slot || !collect) {
    return res.status(400).json({ error: "Missing slot or collect" });
  }

  console.log(req.body)
  const sql = `
    INSERT INTO positionrecord (Slot, Collect, RSSI_1, RSSI_2, RSSI_3, RecordedAt)
    VALUES (?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      RSSI_1 = COALESCE(VALUES(RSSI_1), RSSI_1),
      RSSI_2 = COALESCE(VALUES(RSSI_2), RSSI_2),
      RSSI_3 = COALESCE(VALUES(RSSI_3), RSSI_3),
      RecordedAt = NOW()
  `;
  db.query(sql, [slot, collect, r1, r2, r3], (err, result) => {
    if (err) return res.status(500).json({ error: err.code, detail: err.sqlMessage });
    res.json({ ok: true, affected: result.affectedRows });
  });
});

// API สำหรับเรียกข้อมูลที่บันทึกล่าสุด PositionRecord
app.get("/api/positionrecord/recent", (req, res) => {
  const sql = `
    SELECT Slot, Collect, RSSI_1, RSSI_2, RSSI_3, RecordedAt
    FROM positionrecord
    ORDER BY RecordedAt DESC
    LIMIT 20
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(rows);
  });
});


app.get('/api/beacons', async (req, res) => {
  const sql = `
    SELECT BeaconID, BeaconName, Address, Major, Minor, CreatedAt, UpdatedAt
    FROM beacon
    ORDER BY BeaconID DESC
  `;
  try {
    const rows = await db.queryAsync(sql);
    res.json(rows);
  } catch (err) { sendDbError(res, err, 'GET /api/beacons'); }
});

app.get('/api/beacons/:id', async (req, res) => {
  const sql = `SELECT BeaconID, BeaconName, Address, Major, Minor, CreatedAt, UpdatedAt
               FROM beacon WHERE BeaconID = ?`;
  try {
    const rows = await db.queryAsync(sql, [req.params.id]);
    res.json(rows[0] || {});
  } catch (err) { sendDbError(res, err, 'GET /api/beacons/:id'); }
});

app.post('/api/beacons', async (req, res) => {
  const { BeaconName, Address, Major = null, Minor = null } = req.body || {};
  if (!BeaconName || !Address) {
    return res.status(400).json({ error: 'BeaconName และ Address จำเป็นต้องมี' });
  }
  const mac = String(Address).toUpperCase().trim();
  const macRe = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
  if (!macRe.test(mac)) {
    return res.status(400).json({ error: 'รูปแบบ MAC ไม่ถูกต้อง (ต้องเป็น XX:XX:XX:XX:XX:XX)' });
  }

  const sql = `
    INSERT INTO beacon (BeaconName, Address, Major, Minor)
    VALUES (?, ?, ?, ?)
  `;
  try {
    const result = await db.queryAsync(sql, [BeaconName.trim(), mac, Major, Minor]);
    res.json({ insertedId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'MAC นี้มีอยู่แล้วในระบบ' });
    }
    sendDbError(res, err, 'POST /api/beacons');
  }
});

app.put('/api/beacons/:id', async (req, res) => {
  const id = req.params.id;
  let { BeaconName, Address, Major, Minor } = req.body || {};

  // เตรียม Address ให้เป็น MAC uppercase ถ้ามีส่งมา
  if (Address !== undefined) {
    Address = String(Address).toUpperCase().trim();
    const macRe = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
    if (Address !== '' && !macRe.test(Address)) {
      return res.status(400).json({ error: 'รูปแบบ MAC ไม่ถูกต้อง' });
    }
  }

  const fields = [];
  const values = [];
  const add = (col, val) => {
    if (val !== undefined) {
      // ถ้าค่าว่าง '' → ไม่อัปเดตคอลัมน์
      fields.push(`${col} = IFNULL(NULLIF(?, ''), ${col})`);
      values.push(val);
    }
  };

  add('BeaconName', BeaconName?.trim?.() ?? BeaconName);
  add('Address', Address);
  add('Major', Major);
  add('Minor', Minor);

  if (fields.length === 0) return res.json({ updated: 0, note: 'no-change' });

  const sql = `UPDATE beacon SET ${fields.join(', ')}, UpdatedAt = NOW() WHERE BeaconID = ?`;
  values.push(id);

  try {
    const result = await db.queryAsync(sql, values);
    res.json({ updated: result.affectedRows });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'MAC นี้มีอยู่แล้วในระบบ' });
    }
    sendDbError(res, err, 'PUT /api/beacons/:id');
  }
});

app.delete('/api/beacons/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.queryAsync('DELETE FROM beacon WHERE BeaconID = ?', [id]);
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    // ถ้าลบไม่ได้เพราะมีการใช้งานอยู่ใน product_beacon
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'ลบไม่ได้: Beacon ถูกผูกกับสินค้าอยู่ใน product_beacon' });
    }
    sendDbError(res, err, 'DELETE /api/beacons/:id');
  }
});

// body: { productId, beaconId }
app.post('/api/product-beacon', async (req, res) => {
  const { productId, beaconId } = req.body || {};
  if (!productId || !beaconId) {
    return res.status(400).json({ error: 'ต้องมี productId และ beaconId' });
  }
  const sql = `
    INSERT INTO product_beacon (ProductID, BeaconID)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE UpdatedAt = NOW()
  `;
  try {
    const r = await db.queryAsync(sql, [productId, beaconId]);
    res.json({ upserted: true, affectedRows: r.affectedRows });
  } catch (err) { sendDbError(res, err, 'POST /api/product-beacon'); }
});

app.post('/api/product-beacon/link', async (req, res) => {
  const { productId, beaconId } = req.body || {};
  if (!productId || !beaconId) {
    return res.status(400).json({ error: 'ต้องมี productId และ beaconId' });
  }
  const sql = `
    INSERT INTO product_beacon (ProductID, BeaconID)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE UpdatedAt = NOW()
  `;
  try {
    const r = await db.queryAsync(sql, [productId, beaconId]);
    res.json({ upserted: true, affectedRows: r.affectedRows });
  } catch (err) { sendDbError(res, err, 'POST /api/product-beacon/link'); }
});

app.delete('/api/product-beacon/:productId/:beaconId', async (req, res) => {
  const { productId, beaconId } = req.params;
  const sql = `DELETE FROM product_beacon WHERE ProductID = ? AND BeaconID = ?`;
  try {
    const r = await db.queryAsync(sql, [productId, beaconId]);
    res.json({ deleted: r.affectedRows });
  } catch (err) { sendDbError(res, err, 'DELETE /api/product-beacon/:productId/:beaconId'); }
});

// body: { productId, beaconId }
app.delete('/api/product-beacon', async (req, res) => {
  const { productId, beaconId } = req.body || {};
  if (!productId || !beaconId) {
    return res.status(400).json({ error: 'ต้องมี productId และ beaconId' });
  }
  const sql = `DELETE FROM product_beacon WHERE ProductID = ? AND BeaconID = ?`;
  try {
    const r = await db.queryAsync(sql, [productId, beaconId]);
    res.json({ deleted: r.affectedRows });
  } catch (err) { sendDbError(res, err, 'DELETE /api/product-beacon (body)'); }
});

app.get('/api/product-beacon/:productId', async (req, res) => {
  const sql = `
    SELECT pb.ProductID, pb.BeaconID, pb.RSSI_1, pb.RSSI_2, pb.RSSI_3, pb.AssignedAt, pb.UpdatedAt,
           b.BeaconName, b.Address, b.Major, b.Minor
    FROM product_beacon pb
    JOIN beacon b ON b.BeaconID = pb.BeaconID
    WHERE pb.ProductID = ?
    ORDER BY pb.BeaconID ASC
  `;
  try {
    const rows = await db.queryAsync(sql, [req.params.productId]);
    res.json(rows);
  } catch (err) { sendDbError(res, err, 'GET /api/product-beacon/:productId'); }
});

app.get('/api/product-beacon-map', async (req, res) => {
  const sql = `
    SELECT pb.ProductID  AS productId,
           pb.BeaconID   AS beaconId,
           b.Address     AS address,
           b.BeaconName  AS beaconName,
           pb.UpdatedAt  AS updatedAt
    FROM product_beacon pb
    JOIN beacon b ON b.BeaconID = pb.BeaconID
    ORDER BY pb.ProductID ASC, pb.BeaconID ASC
  `;
  try {
    const rows = await db.queryAsync(sql);
    res.json(rows);
  } catch (err) { sendDbError(res, err, 'GET /api/product-beacon-map'); }
});



// GET /api/product-beacon-map
// ตัวอย่างผลลัพธ์: [{productId, beaconId, address, beaconName, updatedAt}]
app.get("/api/product-beacon-map", (req, res) => {
  const sql = `
    SELECT pb.ProductID  AS productId,
           pb.BeaconID   AS beaconId,
           b.Address     AS address,
           b.BeaconName  AS beaconName,
           pb.RSSI_1, pb.RSSI_2, pb.RSSI_3,
           pb.AssignedAt, pb.UpdatedAt
    FROM product_beacon pb
    JOIN beacon b ON b.BeaconID = pb.BeaconID
    ORDER BY pb.ProductID ASC, pb.BeaconID ASC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.code, detail: err.sqlMessage });
    res.json(rows);
  });
});

app.get("/api/product-beacon-map/:productId", (req, res) => {
  const sql = `
    SELECT pb.ProductID AS productId, pb.BeaconID AS beaconId,
           b.Address AS address, b.BeaconName AS beaconName,
           pb.RSSI_1, pb.RSSI_2, pb.RSSI_3
    FROM product_beacon pb
    JOIN beacon b ON b.BeaconID = pb.BeaconID
    WHERE pb.ProductID = ?
    ORDER BY pb.BeaconID ASC
  `;
  db.query(sql, [req.params.productId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.code, detail: err.sqlMessage });
    res.json(rows);
  });
});

// update-rssi-product-beacon
app.post('/update-rssi-current', (req, res) => {
    const { productId, beaconId, rssi, laptopIndex } = req.body;
  
    // ป้องกัน index ผิดพลาด
    if (![1, 2, 3, 4].includes(laptopIndex)) {
      return res.status(400).json({ error: 'laptopIndex ต้องเป็น 1-4 เท่านั้น' })
    }
  
    // สร้างชื่อ field แบบ dynamic เช่น rssi_1
    const field = `rssi_${laptopIndex}`
    const sql = `UPDATE product_beacon SET ${field} = ? WHERE productId = ? AND beaconId = ?`
  
    db.query(sql, [rssi, productId, beaconId], (err, result) => {
      if (err) {
        console.error('❌ UPDATE ERROR:', err)
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดต RSSI' })
      }
      res.json({ success: true, affectedRows: result.affectedRows })
    })
});

app.post('/collect-rssi', (req, res) => {
  const {slot, collect, rssi_1} = req.body
  console.log(req.body)
  if (slot == null || collect == null || rssi_1 == null) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' })
  }
  
  const sql = `
    INSERT INTO positionrecord (Slot, Collect, RSSI_1, RecordedAt)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      RSSI_1 = VALUES(RSSI_1)
  `

  db.query(sql, [slot, collect, rssi_1], (err) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'บันทึกไม่สำเร็จ' })
    }
    res.json({ success: true })
  })
})

// สินค้ารวม + ค้นหา
// ===========================
// ✅ ดึงข้อมูลสินค้า (Search ได้)
// ===========================
// GET /api/products?q=น้ำ
app.get('/api/products', async (req, res) => {
  const q = (req.query.q || '').trim();
  const like = `%${q}%`;
  const sql = `
    SELECT 
      p.ProductID, p.Name, p.Category, p.Description, p.CreatedAt,
      pb.BeaconID, b.BeaconName, b.Address
    FROM product p
    LEFT JOIN product_beacon pb ON pb.ProductID = p.ProductID
    LEFT JOIN beacon b ON b.BeaconID = pb.BeaconID
    WHERE ? = '' OR (p.Name LIKE ? OR p.Category LIKE ? OR p.Description LIKE ? OR CAST(p.ProductID AS CHAR) LIKE ?)
    ORDER BY p.ProductID DESC
    LIMIT 200
  `;
  try {
    const rows = await db.queryAsync(sql, [q, like, like, like, like]);
    res.json(rows);
  } catch (err) { sendDbError(res, err, 'GET /api/products'); }
});

// GET /api/product-location/:productId/latest
app.get('/api/product-location/:productId/latest', async (req, res) => {
  const sql = `
    SELECT 
      pl.ProductID,
      pl.Slot        AS slot,
      sl.ShelfLevel  AS shelfLevel,
      sl.ShelfLabel  AS shelfLabel,
      pl.DetectedAt  AS detectedAt
    FROM product_location pl
    LEFT JOIN slotlocation sl ON sl.Slot = pl.Slot
    WHERE pl.ProductID = ?
    ORDER BY pl.DetectedAt DESC
    LIMIT 1
  `;
  try {
    const rows = await db.queryAsync(sql, [req.params.productId]);
    res.json(rows[0] || {});
  } catch (err) { sendDbError(res, err, 'GET /product-location/:id/latest'); }
});

// GET /api/product-location/:productId?limit=20
app.get('/api/product-location/:productId', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 200);
  const sql = `
    SELECT 
      pl.ProductID,
      pl.Slot,
      sl.ShelfLevel,
      sl.ShelfLabel,
      pl.DetectedAt
    FROM product_location pl
    LEFT JOIN slotlocation sl ON sl.Slot = pl.Slot
    WHERE pl.ProductID = ?
    ORDER BY pl.DetectedAt DESC
    LIMIT ?
  `;
  try {
    const rows = await db.queryAsync(sql, [req.params.productId, limit]);
    res.json(rows);
  } catch (err) { sendDbError(res, err, 'GET /product-location/:id'); }
});

app.get('/api/products-with-latest', async (req, res) => {
  const q = (req.query.q || '').trim();
  const like = `%${q}%`;

  const sql = `
    WITH latest AS (
      SELECT pl.ProductID, MAX(pl.DetectedAt) AS DetectedAt
      FROM product_location pl
      GROUP BY pl.ProductID
    )
    SELECT 
      p.ProductID, p.Name, p.Category, p.Description, p.CreatedAt,
      pb.BeaconID, b.BeaconName, b.Address,
      pl.Slot AS latestSlot,
      sl.ShelfLevel AS latestShelfLevel,
      sl.ShelfLabel AS latestShelfLabel,
      pl.DetectedAt AS latestDetectedAt
    FROM product p
    LEFT JOIN product_beacon pb ON pb.ProductID = p.ProductID
    LEFT JOIN beacon b ON b.BeaconID = pb.BeaconID
    LEFT JOIN latest L ON L.ProductID = p.ProductID
    LEFT JOIN product_location pl 
           ON pl.ProductID = p.ProductID AND pl.DetectedAt = L.DetectedAt
    LEFT JOIN slotlocation sl ON sl.Slot = pl.Slot
    WHERE ? = '' OR (p.Name LIKE ? OR p.Category LIKE ? OR p.Description LIKE ? OR CAST(p.ProductID AS CHAR) LIKE ?)
    ORDER BY p.ProductID DESC
    LIMIT 200
  `;
  try {
    const rows = await db.queryAsync(sql, [q, like, like, like, like]);
    res.json(rows);
  } catch (err) { sendDbError(res, err, 'GET /products-with-latest'); }
});

app.post('/predict-slot/:productId', async (req, res) => {
  const productId = req.params.productId;

  // 1. ดึง RSSI จาก product_beacon
  const getRSSI = `SELECT * FROM product_beacon WHERE productId = ?`;
  db.query(getRSSI, [productId], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ error: 'ไม่พบสินค้า' });

    const beacon = rows[0];
    const currentRSSI = [beacon.RSSI_1, beacon.RSSI_2, beacon.RSSI_3];

    console.log("🔍 RSSI ปัจจุบัน:", currentRSSI);

    // 2. ตรวจสอบว่า RSSI ทั้งหมดเป็น null หรือ 0 → ถือว่ายังไม่วาง
    if (currentRSSI.every(val => val === null || val === 0 || typeof val !== 'number')) {
      return res.json({
        productId,
        predictedSlot: null,
        shelfLevel: null,
        message: "สินค้าไม่ได้อยู่บนชั้นวาง"
      });
    }

    // 3. ดึงค่าเฉลี่ย RSSI ของแต่ละ slot
    const query = `
      SELECT slot, 
        AVG(rssi_1) as avg_rssi_1,
        AVG(rssi_2) as avg_rssi_2,
        AVG(rssi_3) as avg_rssi_3
      FROM positionrecord
      GROUP BY slot
    `;

    db.query(query, (err2, results) => {
      if (err2) return res.status(500).json({ error: 'ดึงตำแหน่งล้มเหลว' });

      let closestSlot = null;
      let minDistance = Infinity;

      results.forEach(slotRow => {
        const slotRSSI = [
          slotRow.avg_rssi_1,
          slotRow.avg_rssi_2,
          slotRow.avg_rssi_3
        ];

        if (slotRSSI.some(val => val === null)) return;

        const distance = Math.sqrt(slotRSSI.reduce((sum, avg, i) => {
          return sum + Math.pow(currentRSSI[i] - avg, 2);
        }, 0));

        if (distance < minDistance) {
          minDistance = distance;
          closestSlot = slotRow.slot;
        }
      });

      if (closestSlot !== null) {
        // 4. บันทึกลง product_location
        const saveQuery = `
          REPLACE INTO product_location (ProductID, Slot, DetectedAt)
          VALUES (?, ?, NOW())
        `;
        db.query(saveQuery, [productId, closestSlot], (err3) => {
          if (err3) return res.status(500).json({ error: 'บันทึกตำแหน่งล้มเหลว' });

          // 5. JOIN กับ slotlocation เพื่อหาชั้น
          const joinQuery = `
            SELECT sl.ShelfLabel, sl.ShelfLevel
            FROM slotlocation sl
            WHERE sl.Slot = ?
          `;
          db.query(joinQuery, [closestSlot], (err4, locRows) => {
            if (err4 || locRows.length === 0) {
              return res.json({
                productId,
                predictedSlot: closestSlot,
                shelfLevel: null,
                message: "ไม่พบข้อมูลชั้นของ Slot นี้"
              });
            }

            const shelf = locRows[0];
            res.json({
              productId,
              predictedSlot: closestSlot,
              shelfLevel: shelf.ShelfLevel,
              shelfLabel: shelf.ShelfLabel,
              distance: minDistance
            });
          });
        });
      } else {
        res.json({
          productId,
          predictedSlot: null,
          shelfLevel: null,
          message: "ไม่สามารถเปรียบเทียบตำแหน่งได้"
        });
      }
    });
  });
});
  
  
  
  

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

