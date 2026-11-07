# Database Backup, Recovery & Disaster Plan

**Project**: TermJobs Platform  
**Target Environment**: MongoDB Atlas Multi-Tenant Cluster  
**Date**: November 2026  

---

## 1. MongoDB Atlas Architecture & Backup Overview

The TermJobs platform utilizes MongoDB Atlas (`termjob.bnwy4et.mongodb.net`, TLS=True) with 63 multi-tenant collections supporting identity, requisitions, work orders, timesheets, and candidate submissions.

### 1.1 High Availability & Data Redundancy
- **Replica Set**: Minimum 3-node replica set (1 Primary, 2 Secondaries) with automated failover in under 5 seconds.
- **TLS/SSL Encryption**: All traffic in flight is encrypted via TLS 1.3.
- **Storage Encryption**: Atlas volume encryption at rest using AES-256.

---

## 2. Backup Strategy & Point-in-Time Recovery (PITR)

| Backup Layer | Mechanism | Frequency | Retention Window | Recovery Point Objective (RPO) |
| :--- | :--- | :--- | :--- | :--- |
| **Continuous Oplog** | Atlas Cloud Backup | Continuous stream | 7 days | **< 1 minute** |
| **Hourly Snapshots** | Automated Atlas Snapshot | Every 1 hour | 24 hours | **< 1 hour** |
| **Daily Snapshots** | Automated Atlas Snapshot | Every 24 hours | 30 days | **< 24 hours** |
| **Weekly Offline Archive**| Compressed mongodump | Weekly | 1 year (Cold storage) | **< 7 days** |

---

## 3. Restoration Runbook & Procedure

### 3.1 Point-in-Time Recovery via Atlas UI / CLI
To restore the database to an exact minute prior to an incident (e.g. accidental corruption or destructive drop):

1. **Access MongoDB Atlas Console**:
   - Navigate to **Deployments** → **Databases** → Select Cluster `termjob`.
   - Click **Backup** tab → Select **Point in Time Restore**.
2. **Select Target Timestamp**:
   - Choose the precise UTC timestamp prior to the incident.
3. **Select Restoration Target**:
   - **CRITICAL**: Always select **"Restore to a new cluster"** (e.g. `termjob-restored-staging`).
   - Never restore directly over a live primary cluster without staging validation.
4. **Validation & Connection Cutover**:
   - Verify collection counts and document integrity on `termjob-restored-staging`.
   - Update `MONGODB_URL` in backend `.env` to point to the restored cluster.
   - Restart FastAPI backend processes:
     ```bash
     uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
     ```

### 3.2 Command-Line Automated Dump & Restore Runbook
For non-destructive disaster recovery testing or local sandbox synchronization:

```bash
# 1. Export snapshot of non-sensitive collections
mongodump --uri="$MONGODB_URL" --db=termjobs --excludeCollection=users --out=./backup_staging/

# 2. Restore to isolated staging database
mongorestore --uri="$MONGODB_URL" --nsInclude="termjobs.*" --nsRename="termjobs.*:termjobs_recovery_test.*" ./backup_staging/termjobs/

# 3. Verify collection parity
mongosh "$MONGODB_URL" --eval "db.getSiblingDB('termjobs_recovery_test').getCollectionNames()"

# 4. Teardown test recovery catalog
mongosh "$MONGODB_URL" --eval "db.getSiblingDB('termjobs_recovery_test').dropDatabase()"
```

---

## 4. Controlled Recovery Testing Results

During Stage 4 verification:
- Document counts across 63 collections were verified non-destructively.
- The isolation and clean teardown of test records (`records_to_cleanup`) proved zero collateral modification to live collections (`company_profiles`, `requisitions`, `admin_audit_logs`).
- **Disaster Recovery Metrics**:
  - **Recovery Time Objective (RTO)**: Target < 30 minutes from incident to staging cutover.
  - **Recovery Point Objective (RPO)**: < 1 minute via continuous Atlas oplog streaming.

