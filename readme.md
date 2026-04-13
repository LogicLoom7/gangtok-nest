# 🏠 GangtokNest
### *Sikkim's Trusted Peer-to-Peer Housing Network*

**GangtokNest** is a specialized real estate marketplace designed to bridge the gap between local property owners and tenants (students/professionals) in Gangtok, Sikkim. Built with a "Serverless First" approach, it provides a seamless, high-speed experience for finding and listing accommodations.

---

## 🚀 Key Features

### For Tenants (Seekers)
* **Instant Discovery:** Browse verified local listings without needing an account.
* **Geo-Specific Search:** Filter properties by specific Gangtok localities.
* **Direct Communication:** One-tap "Contact Owner" feature to initiate calls directly.

### For Landlords (Partners)
* **Professional Dashboard:** Dedicated portal to manage active listings.
* **Secure Authentication:** Protected partner login using Supabase Auth.
* **Cloud Media Management:** Seamless image uploading for property photos.

---

## 🛠️ Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, Tailwind CSS |
| **Interactions** | Vanilla JavaScript (ES6+) |
| **Backend-as-a-Service** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (JWT) |
| **File Storage** | Supabase Storage (S3-compatible) |

---

## 📐 System Architecture

GangtokNest utilizes a modern **BaaS (Backend-as-a-Service)** architecture. By eliminating the middle-tier server (Node.js/PHP), the application achieves lower latency and high scalability.

---

## 🛡️ Security Implementation (RLS)

The project implements **Row Level Security (RLS)** to ensure data integrity:
* **Public Access:** Anyone can `SELECT` (read) active listings.
* **Authenticated Access:** Only logged-in landlords can `INSERT` new listings.
* **Storage Policies:** Public read-access for images; authenticated write-access restricted by user UID.

---

### 🎓 Academic Context
**Project Type:** MCA Semester Project  
**Author:** Ajay Sharma  
**University:** Sikkim University