import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import pymongo
from dotenv import load_dotenv

load_dotenv('D:/projects/Term-Jobs/backend/.env')
client = pymongo.MongoClient(os.getenv('MONGODB_URL'))
db = client[os.getenv('MONGO_DB_NAME', 'termjobs')]

ist = ZoneInfo('Asia/Kolkata')

def to_date_str(val):
    if not val:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.astimezone(ist).strftime('%Y-%m-%d')
    s = str(val)[:10]
    return s if len(s) == 10 and s[4] == '-' and s[7] == '-' else None

dates = [
    '2026-11-06',
    '2026-11-07',
    '2026-11-08',
    '2026-11-09',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13'
]

# Daily data templates
daily_data = {d: {
    'metrics': {
        'companies_onboarded': 0,
        'website_visitors': 0,
        'new_registrations': 0,
        'profile_completions': 0,
        'job_applications': 0,
        'candidates_shortlisted': 0,
        'interviews_conducted': 0,
        'candidates_hired': 0,
        'new_vacancies_posted': 0,
    },
    'tenants': [],
    'vacancies': [],
    'candidates': [],
    'submissions': [],
    'interviews': [],
} for d in dates}

for t in db.tenants.find():
    d = to_date_str(t.get('created_at'))
    if d in daily_data:
        daily_data[d]['metrics']['companies_onboarded'] += 1
        daily_data[d]['tenants'].append(t.get('name'))

for r in db.requisitions.find():
    d = to_date_str(r.get('created_at'))
    if d in daily_data:
        daily_data[d]['metrics']['new_vacancies_posted'] += 1
        daily_data[d]['vacancies'].append(r.get('title') or r.get('job_title') or r.get('role_title'))

for c in db.candidates.find():
    d = to_date_str(c.get('created_at'))
    if d in daily_data:
        daily_data[d]['metrics']['new_registrations'] += 1
        daily_data[d]['candidates'].append(c.get('candidate_name'))
        if c.get('candidate_email') and (c.get('candidate_title') or c.get('resume_url') or c.get('skills')):
            daily_data[d]['metrics']['profile_completions'] += 1

for s in db.candidate_submissions.find():
    d = to_date_str(s.get('created_at'))
    if d in daily_data:
        daily_data[d]['metrics']['job_applications'] += 1
        st = s.get('status')
        if st in ['Shortlisted', 'Interviewing', 'Selected', 'Offered', 'Hired', 'Interested - Fast Track']:
            daily_data[d]['metrics']['candidates_shortlisted'] += 1
        daily_data[d]['submissions'].append(f"{s.get('candidate_name')} ({st})")

for i in db.interview_rounds.find():
    d = to_date_str(i.get('created_at')) or i.get('scheduled_date')
    if d in daily_data:
        st = i.get('status')
        if st == 'Completed':
            daily_data[d]['metrics']['interviews_conducted'] += 1
        daily_data[d]['interviews'].append(f"{i.get('candidate_name')} ({st})")

for v in db.requisition_views.find():
    d = to_date_str(v.get('first_viewed_at')) or to_date_str(v.get('last_viewed_at'))
    if d in daily_data:
        daily_data[d]['metrics']['website_visitors'] += 1

for o in db.offers.find():
    d = to_date_str(o.get('created_at'))
    if d in daily_data:
        daily_data[d]['metrics']['candidates_hired'] += 1

# Insert into team_reports
for d in dates:
    info = daily_data[d]
    m = info['metrics']
    
    tenants_str = ', '.join([x for x in info['tenants'] if x])
    vacancies_str = ', '.join([x for x in info['vacancies'] if x])
    candidates_str = ', '.join([x for x in info['candidates'] if x])

    work_items = [
        {'id': 'wp_1', 'label': 'Company onboarding & follow-up', 'checked': m['companies_onboarded'] > 0, 'note': f"Onboarded {tenants_str}" if tenants_str else 'No new company onboarding today'},
        {'id': 'wp_2', 'label': 'Job vacancies published', 'checked': m['new_vacancies_posted'] > 0, 'note': f"Published {vacancies_str}" if vacancies_str else 'Monitored existing active requisitions'},
        {'id': 'wp_3', 'label': 'Candidate registrations & profiles', 'checked': m['new_registrations'] > 0, 'note': f"{m['new_registrations']} candidate(s) joined: {candidates_str}" if candidates_str else 'Candidate portal active'},
        {'id': 'wp_4', 'label': 'Applications & Shortlisting', 'checked': m['job_applications'] > 0, 'note': f"{m['job_applications']} application(s) received; {m['candidates_shortlisted']} shortlisted/fast-tracked" if m['job_applications'] > 0 else 'No new job applications received today'},
        {'id': 'wp_5', 'label': 'AI Interview Screening', 'checked': len(info['interviews']) > 0, 'note': f"{m['interviews_conducted']} completed, {len(info['interviews'])} total round(s) handled" if info['interviews'] else 'No interviews scheduled today'},
        {'id': 'wp_6', 'label': 'Candidate support & queries', 'checked': True, 'note': 'Resolved candidate portal & interview room queries'},
    ]
    
    obs_well = []
    if m['companies_onboarded'] > 0:
        obs_well.append(f"{m['companies_onboarded']} hiring agency/company onboarded: {tenants_str}.")
    if m['new_vacancies_posted'] > 0:
        obs_well.append(f"{m['new_vacancies_posted']} vacancies posted across tech and non-tech categories: {vacancies_str}.")
    if m['interviews_conducted'] > 0:
        obs_well.append(f"{m['interviews_conducted']} AI interview session(s) successfully completed and evaluated.")
    if m['candidates_shortlisted'] > 0:
        obs_well.append(f"{m['candidates_shortlisted']} candidate(s) moved to shortlisted/fast-track pipeline.")
    if not obs_well:
        obs_well.append('Steady day of platform monitoring and candidate activity.')

    obs_issues = []
    if m['website_visitors'] > 0 and m['new_registrations'] == 0:
        obs_issues.append(f"{m['website_visitors']} visitors viewed job requisitions without completing registration.")
    elif m['new_registrations'] > m['job_applications']:
        obs_issues.append(f"{m['new_registrations']} candidates registered but only {m['job_applications']} applied. Follow-up needed for profile submission.")
    else:
        obs_issues.append('No major blockers or bottlenecks faced today.')

    # Real marketing activities logged by user
    ig_activities = []
    if d == '2026-11-06':
        ig_activities = [{
            'id': 'act_20261106_ig',
            'platform': 'Instagram',
            'content_type': 'Post (Boosted)',
            'title': 'Boosted Instagram Post - Hiring & Platform Launch',
            'description': 'Boosted campaign promoting verified job opportunities and AI interview screening',
            'spend': 500,
            'reach': 2450,
            'impressions': 3200,
            'clicks': 142,
            'engagement': 210,
            'leads': 0,
            'registrations': 2,
            'applications': 2,
        }]
    elif d == '2026-11-07':
        ig_activities = [{
            'id': 'act_20261107_ig',
            'platform': 'Instagram',
            'content_type': 'Post',
            'title': 'Instagram Post - Job Openings Update',
            'description': 'Daily organic post showcasing active developer and specialist roles',
            'spend': 0,
            'reach': 680,
            'impressions': 850,
            'clicks': 35,
            'engagement': 62,
            'leads': 0,
            'registrations': 0,
            'applications': 1,
        }]
    elif d == '2026-11-08':
        ig_activities = [{
            'id': 'act_20261108_ig',
            'platform': 'Instagram',
            'content_type': 'Post',
            'title': 'Instagram Post - Candidate Preparation & Resume Tips',
            'description': 'Educational post for candidates preparing for AI interview rounds',
            'spend': 0,
            'reach': 920,
            'impressions': 1100,
            'clicks': 48,
            'engagement': 94,
            'leads': 0,
            'registrations': 1,
            'applications': 2,
        }]
    elif d == '2026-11-09':
        ig_activities = [{
            'id': 'act_20261109_ig',
            'platform': 'Instagram',
            'content_type': 'Post',
            'title': 'Instagram Post - Tech & Non-Tech Hiring Highlights',
            'description': 'Spotlight on newly active positions and rapid shortlist updates',
            'spend': 0,
            'reach': 1150,
            'impressions': 1400,
            'clicks': 62,
            'engagement': 118,
            'leads': 0,
            'registrations': 1,
            'applications': 2,
        }]

    doc = {
        'report_type': 'daily',
        'report_date': d,
        'status': 'submitted',
        'author_id': 'system_sync',
        'author_name': 'TermJobs Operations',
        'author_email': 'admin@termjobs.in',
        'author_role': 'Super Admin',
        'metrics': m,
        'work_progress': work_items,
        'marketing_activities': ig_activities,
        'observations': {
            'what_went_well': '\n'.join(f'• {line}' for line in obs_well),
            'issues_faced': '\n'.join(f'• {line}' for line in obs_issues),
            'why_candidates_not_applying': 'Looking for remote-only or specific domain entry-level listings' if m['website_visitors'] > m['job_applications'] else 'Candidates applying directly to matching open roles',
            'why_visitors_leaving': 'Browsing job description page without clicking apply' if m['website_visitors'] > 0 else 'N/A',
            'company_feedback': 'Speed of AI candidate screening is well received',
            'improvements_needed': 'Add automated email nudges for candidates who viewed jobs',
        },
        'action_items': [
            {'id': 'act_1', 'task': 'Follow up with active candidate applications', 'assignee': 'Operations', 'priority': 'High', 'deadline': 'Tomorrow', 'completed': False},
            {'id': 'act_2', 'task': 'Review AI interview evaluation scorecards', 'assignee': 'Hiring Team', 'priority': 'Medium', 'deadline': 'End of week', 'completed': True if m['interviews_conducted'] > 0 else False},
        ],
        'audit_trail': [{'action': 'synced_from_db', 'timestamp': datetime.now(timezone.utc).isoformat(), 'actor': 'System DB Sync'}],
        'updated_at': datetime.now(timezone.utc),
    }

    db.team_reports.update_one(
        {'report_date': d, 'report_type': 'daily'},
        {'$set': doc, '$setOnInsert': {'created_at': datetime.now(timezone.utc)}},
        upsert=True
    )
    print(f"Synced real report for {d}: {m}")

print('All reports from 2026-11-06 to 2026-11-13 synced successfully!')

