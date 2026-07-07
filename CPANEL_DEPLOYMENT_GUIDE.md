# cPanel Deployment Guide for Multi-Tenant POS System

This guide outlines the step-by-step instructions to deploy your Multi-Tenant POS system to your live cPanel hosting.

---

## 📋 Pre-configured Details
We have already updated your database credentials in the backend:
- **MySQL Host**: `sql101.cpanelfree.com`
- **MySQL User**: `cpfr_42335617`
- **MySQL DB Name**: `cpfr_42335617_mk_poss`
- **MySQL Password**: `123456789`

---

## 📂 Deployment File Structure

You should upload your files into your web root directory (usually `public_html` or `htdocs` in cPanel). Organize them as follows:

```text
public_html/ (your web root)
├── assets/                  <-- Upload the CONTENTS of 'frontend/dist/assets/' here
├── backend/                 <-- Upload the 'backend/' directory here
│   ├── config/
│   │   └── db.php
│   ├── controllers/
│   ├── middleware/
│   ├── .htaccess
│   └── index.php
├── .htaccess                <-- Upload the root '.htaccess' file here
└── index.html               <-- Upload 'frontend/dist/index.html' here
```

> ⚠️ **IMPORTANT**: Do not upload the entire `frontend` source folder (like `frontend/src`, `frontend/node_modules`, etc.). Only upload the compiled files inside `frontend/dist/` directly to the web root.

---

## 🚀 Step-by-Step Deployment

### Step 1: Zip the files for upload
To upload files quickly, you can compress them into a zip file:
1. Compile the frontend on your local machine (done automatically).
2. Go to `frontend/dist` and compress `assets` and `index.html` into a zip file named `frontend.zip`.
3. Compress the `backend` folder and the root `.htaccess` file into `backend.zip`.

### Step 2: Upload and extract in cPanel File Manager
1. Log in to your cPanel control panel at `https://cpanel.cpanelfree.com/panel/indexpl.php?id=d9c50098e292e8118740e06935a4bfb9ac4df74b`.
2. Click on **File Manager** and enter the `public_html` folder (or your domain's document root).
3. Upload `frontend.zip` and `backend.zip` to the directory.
4. Extract both zip files.
5. Ensure the structure matches the [Deployment File Structure](#-deployment-file-structure) shown above.

### Step 3: Verify the Database & Live Status
The backend is designed to **automatically run database migrations** on the very first connection. It will create all necessary tables and seed the Super Admin user.
1. Open your browser and navigate to:
   `http://<your-domain>/backend/diagnostic`
   *(Replace `<your-domain>` with your actual website URL)*
2. This diagnostics page will run database checks and output the status.
3. If the connection is successful, you will see a text summary showing that the tables were created and the Super Admin user was seeded.

---

## 🔑 Login Credentials

Once deployment is complete, log in using these default credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `mk.rabbani.cse@gmail.com` | `123456789` |

From the Super Admin panel, you can create new shop tenants and reset passwords.

---

## 🛠️ Troubleshooting

- **404 Page Not Found on Refresh**: Make sure you uploaded the root-level `.htaccess` file. This file redirects all page routing back to React Router.
- **Database Connection Failure**: Check that your hosting provider has not blocked external/internal database connections. Since you are running the database on `sql101.cpanelfree.com`, it must be reachable from the PHP script.
