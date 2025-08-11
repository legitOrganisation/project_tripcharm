````
# API Documentation + Test Commands

This API manages **GPS data**, **commands**, **battery percentage**, and **geofencing data**.  
All data is persisted in queues (`queues.json`) and survives server restarts.  
Uploads and downloads are logged with timestamps in `events.log`.

**Base URL (local development)**  
http://localhost:3000

---

## 📍 GPS Data

### Upload GPS
**POST** `/api/upload/gps`  
**Content-Type:** `application/json`  

**Request Body:**
```json
{
  "gps": { "lat": 1.3521, "lon": 103.8198 }
}
````

**Response:**

```
GPS data uploaded
```

**Test Command (PowerShell):**

```powershell
curl -X POST http://localhost:3000/api/upload/gps -H "Content-Type: application/json" -d "{\"gps\":{\"lat\":1.3521,\"lon\":103.8198}}"
```

---

### Download GPS

**GET** `/api/download/gps`

**Response Example:**

```json
[
  {
    "gps": { "lat": 1.3521, "lon": 103.8198 },
    "timestamp": "2025-08-09T07:26:26.028Z"
  }
]
```

**Test Command:**

```powershell
curl http://localhost:3000/api/download/gps
```

---

## 💻 Command Data

### Upload Command

**POST** `/api/upload/command`
**Content-Type:** `application/json`

**Request Body:**

```json
{
  "command": "vibrate"
}
```

**Response:**

```
Command uploaded
```

**Test Command:**

```powershell
curl -X POST http://localhost:3000/api/upload/command -H "Content-Type: application/json" -d "{\"command\":\"vibrate\"}"
```

---

### Download Command

**GET** `/api/download/command`

**Response Example:**

```json
[
  {
    "command": "vibrate",
    "timestamp": "2025-08-09T07:27:10.028Z"
  }
]
```

**Test Command:**

```powershell
curl http://localhost:3000/api/download/command
```

---

## 🔋 Battery Percentage

### Upload Battery Percentage

**POST** `/api/upload/batt-percentage`
**Content-Type:** `application/json`

**Request Body:**

```json
{
  "percentage": 85
}
```

**Response:**

```
Battery percentage uploaded
```

**Test Command:**

```powershell
curl -X POST http://localhost:3000/api/upload/batt-percentage -H "Content-Type: application/json" -d "{\"percentage\":85}"
```

---

### Download Battery Percentage

**GET** `/api/download/batt-percentage`

**Response Example:**

```json
[
  {
    "percentage": 85,
    "timestamp": "2025-08-09T07:28:05.028Z"
  }
]
```

**Test Command:**

```powershell
curl http://localhost:3000/api/download/batt-percentage
```

---

## 📍 Geofencing Data

### Upload Geofencing Data

**POST** `/api/upload/geofencing-data`
**Content-Type:** `application/json`

**Request Body:**

```json
{
  "data": {
    "radius": 100,
    "center": { "lat": 1.3, "lon": 103.8 }
  }
}
```

**Response:**

```
Geofencing data uploaded
```

**Test Command:**

```powershell
curl -X POST http://localhost:3000/api/upload/geofencing-data -H "Content-Type: application/json" -d "{\"data\":{\"radius\":100,\"center\":{\"lat\":1.3,\"lon\":103.8}}}"
```

---

### Download Geofencing Data

**GET** `/api/download/geofencing-data`

**Response Example:**

```json
[
  {
    "data": {
      "radius": 100,
      "center": { "lat": 1.3, "lon": 103.8 }
    },
    "timestamp": "2025-08-09T07:29:15.028Z"
  }
]
```

**Test Command:**

```powershell
curl http://localhost:3000/api/download/geofencing-data
```

---

## 📜 Notes

* All timestamps are in **ISO 8601 UTC** format.
* Data is stored in **FIFO queue order**.
* Upload endpoints **append** to the queue; download endpoints currently **return the full queue**.
* All activity is logged to `events.log`.

```
```
