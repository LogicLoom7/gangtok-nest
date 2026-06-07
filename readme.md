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



CREATE TABLE public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    rent INTEGER NOT NULL CHECK (rent > 0),
    bhk INTEGER NOT NULL,
    floor_level TEXT NOT NULL,
    contact TEXT NOT NULL,
    water TEXT NOT NULL,
    road_dist TEXT NOT NULL,
    sunlight BOOLEAN DEFAULT false NOT NULL,
    parking BOOLEAN DEFAULT false NOT NULL,
    balcony BOOLEAN DEFAULT false NOT NULL,
    image_url TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Activate Row-Level Security Infrastructure for the Custom Relational Node
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Step 3: Instantiate Public Read Access Policy Layer for Anonymous Visitors
CREATE POLICY "Enable generic select queries for unauthenticated tenants" 
ON public.listings 
FOR SELECT 
USING (true);

-- Step 4: Instantiate Secure Write Access Policy Layer for Authenticated Landlords
CREATE POLICY "Enable landlord data entry injection rows" 
ON public.listings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Step 5: Instantiate Administrative Modification Access Policy Layer 
CREATE POLICY "Restrict property updates exclusively to verified row owners" 
ON public.listings 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 6: Instantiate Administrative Deletion Access Policy Layer
CREATE POLICY "Restrict row purging explicitly to verified row owners" 
ON public.listings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Step 7: Build Computational Index Optimizations to Support Fast Search Feeds
CREATE INDEX idx_listings_location ON public.listings(location);
CREATE INDEX idx_listings_rent ON public.listings(rent);