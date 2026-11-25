import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './NewLandingPage.css';

const P_DATA = [
  { id: 'TJ-1042', cat: 'Data', role: 'Data Engineer', yrs: 9, loc: 'Pune', mode: 'Hybrid', av: 'Available in 1 week', sk: ['Python', 'Spark', 'Airflow', 'AWS'] },
  { id: 'TJ-1047', cat: 'Design', role: 'UX Designer', yrs: 7, loc: 'Bengaluru', mode: 'Remote', av: 'Available now', sk: ['Figma', 'Design systems', 'User research'] },
  { id: 'TJ-1051', cat: 'QA', role: 'QA Engineer', yrs: 11, loc: 'Kochi', mode: 'On-site', av: 'Available in 2 weeks', sk: ['Selenium', 'API testing', 'Test strategy'] },
  { id: 'TJ-1058', cat: 'Engineering', role: 'Full-Stack Engineer', yrs: 8, loc: 'Remote, India', mode: 'Remote', av: 'Available in 2 weeks', sk: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'] },
  { id: 'TJ-1063', cat: 'DevOps', role: 'DevOps Engineer', yrs: 6, loc: 'Hyderabad', mode: 'Hybrid', av: 'Available in 1 week', sk: ['Kubernetes', 'Terraform', 'CI/CD', 'Azure'] },
  { id: 'TJ-1069', cat: 'Data', role: 'Data Analyst', yrs: 4, loc: 'Bengaluru', mode: 'Hybrid', av: 'Available now', sk: ['SQL', 'Power BI', 'Excel', 'Python'] },
  { id: 'TJ-1074', cat: 'Design', role: 'Product Designer', yrs: 5, loc: 'Chennai', mode: 'Remote', av: 'Available in 3 weeks', sk: ['Prototyping', 'Figma', 'Mobile apps'] },
  { id: 'TJ-1081', cat: 'QA', role: 'QA Automation Engineer', yrs: 7, loc: 'Kochi', mode: 'Hybrid', av: 'Available now', sk: ['Cypress', 'Playwright', 'Java', 'Jenkins'] },
  { id: 'TJ-1086', cat: 'DevOps', role: 'Cloud Architect', yrs: 12, loc: 'Mumbai', mode: 'Hybrid', av: 'Available in 4 weeks', sk: ['AWS', 'Solution design', 'Security', 'Cost control'] }
];

const J_DATA = [
  {
    id: 'TJ-R101', t: 'Senior Full-Stack Engineer', cat: 'Engineering', ind: 'Fintech', mode: 'Remote', loc: 'India', type: 'Contract', mo: 6, pay: '₹1.8–2.4L / month', start: 'Within 2 weeks', exp: '6+ years', op: 2, d: 1,
    sum: 'Build payment dashboards and APIs for a fast-growing lending platform.', sk: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    about: 'A Series B fintech needs a hands-on engineer to ship its merchant dashboard and underwriting APIs before the festive season peak.',
    do: ['Build and ship features across React and Node.js services', 'Design REST APIs and own database performance', 'Review code and mentor two mid-level engineers'],
    need: ['6+ years of full-stack experience', 'Strong TypeScript and SQL', 'Experience with payments or high-traffic systems is a plus']
  },
  {
    id: 'TJ-R102', t: 'Product Marketing Lead', cat: 'Marketing', ind: 'SaaS', mode: 'Hybrid', loc: 'Mumbai', type: 'Contract', mo: 12, pay: '₹1.5–2.0L / month', start: 'Within 4 weeks', exp: '8+ years', op: 1, d: 2,
    sum: 'Own positioning and launch plans for a B2B analytics suite entering new markets.', sk: ['Positioning', 'Go-to-market', 'Content', 'Analytics'],
    about: 'Lead product marketing for a B2B SaaS company expanding into South-East Asia, working closely with product and sales.',
    do: ['Define messaging and positioning for each launch', 'Plan and run go-to-market campaigns', 'Equip sales with decks, case studies and battlecards'],
    need: ['8+ years in B2B product marketing', 'Proven launch track record', 'Clear writing and strong stakeholder skills']
  },
  {
    id: 'TJ-R103', t: 'Data Analyst', cat: 'Data', ind: 'Retail', mode: 'On-site', loc: 'Bengaluru', type: 'Permanent', mo: 0, pay: '₹14–18 LPA', start: '30 days notice ok', exp: '3+ years', op: 3, d: 3,
    sum: 'Turn store and e-commerce data into weekly decisions for category teams.', sk: ['SQL', 'Power BI', 'Excel', 'Python'],
    about: 'Join the insights team of a national retail brand and help category managers decide what to stock, price and promote.',
    do: ['Build and maintain Power BI dashboards', 'Write SQL to analyse sales, stock and pricing', 'Present weekly insights to category heads'],
    need: ['3+ years as a data or BI analyst', 'Very good SQL', 'Comfortable explaining numbers to non-technical teams']
  },
  {
    id: 'TJ-R104', t: 'Data Engineer', cat: 'Data', ind: 'Healthcare', mode: 'Hybrid', loc: 'Pune', type: 'Contract', mo: 8, pay: '₹2.0–2.6L / month', start: 'Within 2 weeks', exp: '7+ years', op: 1, d: 2,
    sum: 'Modernise batch pipelines and move reporting to a cloud lakehouse.', sk: ['Python', 'Spark', 'Airflow', 'AWS'],
    about: 'A healthcare technology company is migrating legacy ETL to a cloud lakehouse and needs an experienced engineer to lead the build.',
    do: ['Design and build Spark pipelines on AWS', 'Orchestrate jobs with Airflow', 'Set up data quality checks and monitoring'],
    need: ['7+ years in data engineering', 'Production Spark and Airflow', 'Experience with regulated data is a plus']
  },
  {
    id: 'TJ-R105', t: 'UX Designer', cat: 'Design', ind: 'E-commerce', mode: 'Remote', loc: 'India', type: 'Contract', mo: 4, pay: '₹1.2–1.6L / month', start: 'Immediately', exp: '5+ years', op: 2, d: 4,
    sum: 'Redesign the checkout and returns flow for a marketplace app.', sk: ['Figma', 'Design systems', 'User research'],
    about: 'A marketplace wants a designer to cut checkout drop-off and make returns painless across web and mobile.',
    do: ['Run quick user interviews and usability tests', 'Design flows and prototypes in Figma', 'Extend the existing design system'],
    need: ['5+ years in product or UX design', 'Portfolio with mobile work', 'Comfortable with data-informed design']
  },
  {
    id: 'TJ-R106', t: 'DevOps Engineer', cat: 'DevOps', ind: 'Logistics', mode: 'Hybrid', loc: 'Hyderabad', type: 'Contract', mo: 9, pay: '₹1.8–2.3L / month', start: 'Within 3 weeks', exp: '5+ years', op: 1, d: 5,
    sum: 'Harden CI/CD and Kubernetes clusters for a tracking platform.', sk: ['Kubernetes', 'Terraform', 'CI/CD', 'Azure'],
    about: 'A logistics platform tracking millions of shipments a day needs stronger deployment pipelines and cluster reliability.',
    do: ['Automate infrastructure with Terraform', 'Improve CI/CD speed and safety', 'Add observability and on-call runbooks'],
    need: ['5+ years in DevOps or SRE', 'Production Kubernetes', 'Azure or AWS certification preferred']
  },
  {
    id: 'TJ-R107', t: 'QA Automation Engineer', cat: 'QA', ind: 'Banking', mode: 'On-site', loc: 'Kochi', type: 'Contract', mo: 6, pay: '₹1.3–1.7L / month', start: 'Within 2 weeks', exp: '4+ years', op: 2, d: 6,
    sum: 'Automate regression suites for a mobile banking app release train.', sk: ['Cypress', 'Playwright', 'Java', 'Jenkins'],
    about: 'A banking client ships fortnightly and wants reliable automated regression coverage across web and mobile channels.',
    do: ['Build Playwright and Cypress suites', 'Integrate tests into Jenkins pipelines', 'Triage failures and report quality metrics'],
    need: ['4+ years in test automation', 'Solid API testing skills', 'Banking domain knowledge is a plus']
  },
  {
    id: 'TJ-R108', t: 'Cloud Architect', cat: 'DevOps', ind: 'Insurance', mode: 'Hybrid', loc: 'Mumbai', type: 'Contract', mo: 12, pay: '₹3.0–3.8L / month', start: 'Within 4 weeks', exp: '12+ years', op: 1, d: 7,
    sum: 'Define the target cloud architecture for a core-systems migration.', sk: ['AWS', 'Solution design', 'Security', 'Cost control'],
    about: 'An insurer is moving core policy systems to the cloud and needs a senior architect to set direction and guide delivery teams.',
    do: ['Define target architecture and landing zones', 'Review designs for security and cost', 'Advise delivery teams through the migration'],
    need: ['12+ years including 5+ in cloud architecture', 'AWS Professional certification', 'Experience with large migrations']
  },
  {
    id: 'TJ-R109', t: 'Backend Engineer (Java)', cat: 'Engineering', ind: 'Telecom', mode: 'Remote', loc: 'India', type: 'Permanent', mo: 0, pay: '₹22–30 LPA', start: '60 days notice ok', exp: '5+ years', op: 2, d: 8,
    sum: 'Scale billing microservices that serve tens of millions of subscribers.', sk: ['Java', 'Spring Boot', 'Kafka', 'Microservices'],
    about: 'A telecom product team is rebuilding its billing engine as event-driven microservices.',
    do: ['Build Spring Boot services and Kafka consumers', 'Improve throughput and reliability', 'Write clear technical docs'],
    need: ['5+ years of Java backend experience', 'Kafka or similar messaging', 'Good grasp of distributed systems']
  },
  {
    id: 'TJ-R110', t: 'Content Strategist', cat: 'Marketing', ind: 'Edtech', mode: 'Remote', loc: 'India', type: 'Contract', mo: 3, pay: '₹80K–1.1L / month', start: 'Immediately', exp: '4+ years', op: 1, d: 9,
    sum: 'Plan and edit a content engine for a K-12 learning platform.', sk: ['SEO', 'Editorial', 'Brand voice', 'Analytics'],
    about: 'An edtech brand needs a strategist to plan, brief and edit its blog, newsletters and parent guides.',
    do: ['Own the content calendar and briefs', 'Edit freelance and in-house writers', 'Track traffic and sign-ups per piece'],
    need: ['4+ years in content or editorial', 'SEO fundamentals', 'Strong editing eye']
  },
  {
    id: 'TJ-R111', t: 'Product Designer', cat: 'Design', ind: 'Travel', mode: 'Hybrid', loc: 'Chennai', type: 'Permanent', mo: 0, pay: '₹18–26 LPA', start: '30 days notice ok', exp: '5+ years', op: 1, d: 10,
    sum: 'Shape the booking experience for a travel app used across Asia.', sk: ['Prototyping', 'Figma', 'Mobile apps'],
    about: 'A travel company is looking for a product designer to own end-to-end flows in its mobile booking app.',
    do: ['Lead design for booking and trip management', 'Partner with PMs and engineers', 'Ship, measure and iterate'],
    need: ['5+ years of product design', 'Strong mobile craft', 'Experience with experimentation']
  },
  {
    id: 'TJ-R112', t: 'Business Analyst', cat: 'Data', ind: 'Manufacturing', mode: 'On-site', loc: 'Coimbatore', type: 'Contract', mo: 6, pay: '₹1.0–1.4L / month', start: 'Within 3 weeks', exp: '4+ years', op: 2, d: 12,
    sum: 'Gather requirements and map processes for an ERP rollout.', sk: ['Requirements', 'Process mapping', 'SAP', 'Stakeholders'],
    about: 'A manufacturer is rolling out a new ERP and needs an analyst to translate plant processes into clear requirements.',
    do: ['Run workshops with plant teams', 'Document as-is and to-be processes', 'Support UAT and go-live'],
    need: ['4+ years as a business analyst', 'Exposure to SAP or similar ERP', 'Willing to work from the plant']
  }
];

const CONTACT_EMAIL = 'hello@termjobs.in';

const LogoSvg = () => (
  <svg viewBox="44 10 272 213" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M 244.6 52.1 L 227.8 52.1 L 226.8 52 L 226.5 51.6 L 226.5 39.5 L 226.4 38.6 L 225.5 36.3 L 224.6 34.7 L 224 34 L 222 32.3 L 220.1 31.3 L 216.9 30.8 L 143.5 30.7 L 139.9 31.3 L 138 32.2 L 135.9 34.1 L 135.3 34.8 L 134.5 36.2 L 133.6 38.6 L 133.4 40.7 L 133.4 51.6 L 133.1 52 L 132.9 52.1 L 115.6 52.1 L 115.1 51.9 L 114.9 51.4 L 114.9 41.9 L 115.3 35.1 L 115.8 33.8 L 116.2 32.2 L 116.6 31.3 L 117 29.5 L 117.4 29 L 118 27.7 L 118.3 27.4 L 118.7 26.3 L 119.3 25.6 L 119.6 24.7 L 120.1 24.2 L 120.5 23.6 L 123.3 20.3 L 127.7 16.8 L 129 16.2 L 129.3 15.9 L 130.5 15.4 L 131.1 14.9 L 132.5 14.4 L 132.9 14.1 L 134.8 13.6 L 135.9 13.1 L 139.3 12.6 L 139.6 12.4 L 139.6 12.1 L 220.4 12.1 L 220.4 12.4 L 220.6 12.6 L 224 13.1 L 225 13.6 L 226.9 14 L 227.4 14.3 L 228.7 14.8 L 229.5 15.4 L 230.4 15.7 L 230.8 16.1 L 232.2 16.7 L 233.4 17.6 L 234.7 18.8 L 236.6 20.3 L 238.9 23.2 L 239.4 23.5 L 239.8 24.2 L 240.3 24.7 L 240.6 25.6 L 241.2 26.2 L 241.5 27.2 L 242.9 29.5 L 243.2 31.1 L 243.8 32.2 L 244.1 33.8 L 244.6 35.1 L 245 41 L 245 50.8 L 245 51.7 Z M 168 221 L 100.9 221 L 100.3 221 L 100.3 220.7 L 99.4 220.5 L 94.6 219.9 L 93.3 219.5 L 91.5 219.2 L 90.1 218.7 L 88.5 218.4 L 87 217.8 L 85.6 217.4 L 84.8 216.9 L 83.4 216.6 L 82.4 216 L 81.3 215.7 L 80.7 215.2 L 79.5 214.8 L 78.8 214.3 L 77.8 214 L 77.1 213.5 L 76.2 213.1 L 75.5 212.5 L 74.9 212.2 L 72 210.4 L 69.8 208.8 L 69.4 208.3 L 68.6 207.9 L 67.4 206.9 L 67.1 206.5 L 66.5 206.1 L 65.2 204.7 L 63.8 203.5 L 63.5 203.1 L 62.9 202.6 L 61.7 201.2 L 61.3 200.9 L 60.1 199.4 L 59.6 199 L 58.3 197 L 57.8 196.6 L 56.4 194.6 L 56.1 194.2 L 55.8 193.4 L 55 192.5 L 54.8 191.9 L 54.4 191.4 L 52.6 188.1 L 52.2 186.9 L 51.7 186.3 L 51.3 185.1 L 50.8 184.4 L 50.5 183.3 L 49.8 181.8 L 49.5 180.5 L 49.1 179.7 L 48.7 178.1 L 48.2 176.6 L 47.8 174.7 L 47.4 173.6 L 47 169.9 L 46.4 167.5 L 46.2 160.6 L 46.2 60.1 L 46.2 59.5 L 46.6 58.9 L 137.2 58.8 L 137.8 59.3 L 138.4 60 L 138.7 60.9 L 139.1 61.3 L 139.5 62.2 L 140.1 63.1 L 140.5 64 L 141 64.6 L 141.4 65.6 L 141.9 66.4 L 142.3 67.3 L 142.7 67.7 L 143.3 69.1 L 143.7 69.5 L 144 70.4 L 144.3 70.7 L 144.9 72.1 L 145.3 72.5 L 145.7 73.6 L 146.2 74.2 L 146.5 75.1 L 147.2 76 L 148.3 78.3 L 149.6 80.5 L 150.1 81.5 L 150.5 81.9 L 151.1 83.3 L 151.5 83.7 L 151.9 84.8 L 151.9 85.2 L 151.6 85.7 L 74.1 85.8 L 73.7 85.8 L 73.3 86.1 L 73.2 87.2 L 73.2 160.6 L 73.4 164.8 L 73.6 166.7 L 74.4 170 L 74.8 170.8 L 75.1 172.4 L 76.1 174.8 L 76.5 175.3 L 76.8 176.2 L 77.4 177.1 L 77.8 177.9 L 78.3 178.7 L 78.6 179.4 L 79.5 180.6 L 80.1 181.1 L 80.4 181.7 L 82.8 184.4 L 84.3 185.6 L 84.6 186 L 85.3 186.5 L 85.7 186.9 L 86.4 187.4 L 86.8 187.8 L 88 188.7 L 88.9 189.1 L 89.7 189.6 L 90.6 189.9 L 91 190.4 L 91.9 190.7 L 92.8 191.3 L 94.3 191.7 L 95.2 192.2 L 97 192.6 L 98.5 193.2 L 105.8 194.1 L 146.8 194.1 L 147.9 194.3 L 150.1 197.4 L 151.4 198.9 L 152.8 200.8 L 153.2 201.2 L 153.5 201.8 L 154.9 203.4 L 155.3 204.1 L 156.7 205.7 L 158.8 208.6 L 160.1 210.1 L 161.4 212 L 162.8 213.5 L 164.1 215.5 L 166.2 218 L 168 220.6 Z M 195 85.7 L 164.3 85.7 L 163.3 84.5 L 162.7 83.1 L 162.3 82.7 L 162 81.9 L 161.3 80.9 L 161 80.2 L 160.6 79.7 L 160.2 78.7 L 159.7 77.9 L 159.2 76.9 L 158.8 76.3 L 158.5 75.5 L 158 74.8 L 157.5 73.7 L 157.1 73.3 L 156.7 72.2 L 156.2 71.6 L 155.8 70.6 L 155.3 70 L 154.9 68.9 L 154.5 68.5 L 154 67.4 L 153.5 66.7 L 153.2 65.9 L 151.7 63.4 L 151.4 62.7 L 151 62.1 L 150.6 61.2 L 150 60.4 L 149.8 59.5 L 149.9 59.2 L 150.4 58.8 L 151.1 58.8 L 209.7 58.9 L 210 59.5 L 209.8 60 L 208.4 62.3 L 208.1 63.3 L 207.6 63.7 L 207.2 64.9 L 206.7 65.3 L 206.3 66.4 L 205 68.6 L 204.5 69.7 L 204.2 70 L 203.7 71.2 L 203.2 71.8 L 202.9 72.7 L 202.3 73.4 L 201 76.1 L 200.6 76.5 L 200.3 77.3 L 199.6 78.4 L 199.3 79.1 L 198.9 79.6 L 198.5 80.6 L 198 81.2 L 197.6 82.2 L 197 83 L 196.7 83.9 L 195.7 85.4 Z M 259.5 221 L 193 221.1 L 191.8 221 L 191.8 220.7 L 193.7 218 L 195.8 215.5 L 197.1 213.5 L 198.5 212 L 199.8 210.1 L 201.1 208.7 L 203.2 205.7 L 204.5 204.2 L 205.9 202.2 L 207.1 200.8 L 208.5 198.9 L 208.9 198.4 L 209.4 197.7 L 209.8 197.4 L 211.2 195.3 L 212.1 194.3 L 213 194.1 L 254 194.1 L 256.4 193.8 L 261.8 193.1 L 262.8 192.6 L 264.6 192.2 L 265.7 191.7 L 267 191.4 L 267.9 190.7 L 268.8 190.4 L 269.3 190 L 270.2 189.6 L 270.9 189.1 L 271.8 188.7 L 273.1 187.8 L 274.6 186.5 L 275.2 186.1 L 275.5 185.7 L 277.1 184.4 L 281.1 179.6 L 281.6 178.6 L 282.1 177.9 L 282.5 177.1 L 283 176.3 L 283.4 175.3 L 283.8 174.8 L 284.8 172.4 L 285.1 170.9 L 285.7 169.4 L 286.5 165.7 L 286.6 164.3 L 286.7 160.6 L 286.7 86.4 L 286.5 85.9 L 286.2 85.8 L 208.7 85.8 L 208.3 85.6 L 208.1 84.8 L 208.4 83.8 L 208.9 83.3 L 209.5 81.9 L 209.9 81.5 L 210.2 80.6 L 211.5 78.4 L 212.8 75.8 L 213.3 75.2 L 213.6 74.3 L 214.2 73.6 L 214.6 72.5 L 215.1 71.8 L 215.4 71.1 L 216.9 68.5 L 217.2 67.7 L 217.6 67.3 L 217.9 66.4 L 218.5 65.6 L 219 64.6 L 219.4 64 L 219.9 63 L 220.4 62.3 L 220.8 61.3 L 221.2 60.9 L 221.4 60.1 L 222.6 58.8 L 313.2 58.8 L 313.7 59.5 L 313.7 161.4 L 313.5 167.5 L 312.9 170 L 312.6 173 L 312.1 174.7 L 311.8 176.3 L 311.1 178.2 L 310.9 179.7 L 310.4 180.5 L 310.1 181.9 L 309.6 182.9 L 309.1 184.4 L 308.6 185.1 L 308.2 186.3 L 307.7 187 L 307.3 188.1 L 305.5 191.4 L 305.1 191.8 L 304.8 192.5 L 303 195.4 L 301.7 196.9 L 300.3 199 L 299.8 199.5 L 299.5 199.9 L 298.1 201.2 L 297.8 201.7 L 296.4 203.1 L 296.1 203.5 L 294.7 204.8 L 293.3 206.1 L 292.9 206.4 L 292.4 207 L 291.3 207.9 L 290.5 208.3 L 289 209.7 L 286.9 211 L 286.5 211.4 L 284.4 212.5 L 283.8 213 L 282.7 213.5 L 282.1 214 L 281.1 214.3 L 280.3 214.8 L 279.3 215.2 L 278.5 215.7 L 277.5 216.1 L 276.4 216.7 L 275.1 217 L 274.2 217.5 L 272.9 217.8 L 271.5 218.4 L 269.9 218.7 L 268.8 219.1 L 266.7 219.5 L 264.8 220 L 260.4 220.5 L 259.6 220.7 Z M 180 220.6 L 179.6 220.3 L 178.5 218.8 L 177.2 217.4 L 175 214.3 L 173.7 212.9 L 172.4 211 L 170.1 208.3 L 169.7 207.6 L 167.6 205.1 L 166.2 203.1 L 165.7 202.6 L 162.8 198.7 L 161.5 197.2 L 160.1 195.3 L 158.8 193.8 L 157.5 191.9 L 155.3 189.4 L 153.2 186.5 L 152.7 186 L 151.3 184.1 L 149.2 181.5 L 148.6 180.6 L 148.3 179.7 L 148.9 177.8 L 149.3 175.3 L 149.7 174.2 L 150.1 171.7 L 150.5 170.6 L 151 167.6 L 151.5 166.3 L 151.7 164.3 L 152.5 161.9 L 152.8 159.9 L 153.2 158.8 L 153.5 156.4 L 154.1 154.8 L 154.5 152.2 L 154.9 151.2 L 155.3 148.5 L 155.8 147.2 L 156.2 144.6 L 156.7 143.3 L 157.1 140.7 L 157.5 139.5 L 158 136.8 L 158.5 135.4 L 158.9 132.8 L 159.2 131.9 L 159.6 129.8 L 160.2 127.6 L 160.5 125.6 L 161 124 L 161.3 122 L 162 119.6 L 162.4 117.4 L 162.7 116.5 L 163.2 113.8 L 163.7 112.3 L 164.1 109.8 L 164.5 108.7 L 164.8 106.6 L 165.5 104.3 L 165.8 102 L 166.3 100.9 L 166.5 98.9 L 167.3 96.3 L 167.6 94.4 L 168 93.3 L 168.4 90.8 L 168.9 89.2 L 169.5 88.7 L 190.3 88.7 L 191.1 89 L 191.5 89.6 L 191.9 92.3 L 192.4 93.6 L 192.8 96.3 L 193.3 97.7 L 193.6 99.7 L 194.1 101.4 L 194.4 103.3 L 195.1 105.6 L 195.4 107.7 L 195.9 109.2 L 196.1 111.2 L 196.7 113 L 197.2 115.7 L 197.6 116.8 L 198 119.5 L 198.5 121 L 198.9 123.4 L 199.3 124.4 L 199.7 127 L 200.3 129.1 L 200.6 131.1 L 201.1 132.6 L 201.4 134.7 L 202 136.8 L 202.3 138.9 L 202.9 140.4 L 203.1 142.5 L 203.6 144 L 204.2 147 L 204.6 148 L 204.9 150.6 L 205.4 152.1 L 205.9 154.8 L 206.3 155.8 L 206.6 158.2 L 207.2 159.9 L 207.6 162.4 L 208.2 164 L 208.4 166.1 L 208.9 167.6 L 209.4 170.2 L 209.9 171.7 L 210.2 173.9 L 210.6 175.3 L 211.1 177.8 L 211.7 179.7 L 211.3 180.6 L 210.7 181.6 L 209.5 182.9 L 207.2 186 L 206.7 186.5 L 204.5 189.5 L 203.2 191 L 201.8 193.1 L 201.4 193.4 L 201.1 193.9 L 199 196.5 L 198.5 197.3 L 197.2 198.7 L 195.8 200.8 L 195.4 201.1 L 191.6 206.2 L 191.2 206.5 L 189.8 208.6 L 188.4 210.1 L 187.1 212 L 186.6 212.5 L 185.5 214 L 184.9 214.6 L 184.5 215.3 L 183.1 216.9 L 182.8 217.5 L 182.5 217.7 L 181 219.8 Z" />
  </svg>
);

const LockSvg = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="7" rx="2" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </svg>
);

const ChevSvg = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 5 4 4 4-4" />
  </svg>
);

const BookmarkSvg = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M5 3h10v14l-5-3.5L5 17z" />
  </svg>
);

export default function NewLandingPage() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('home');
  const [slideIdx, setSlideIdx] = useState(0);

  // Toggle hero mode: 'hire' | 'cand'
  const [heroMode, setHeroMode] = useState('cand');

  // Candidate pool state
  const [poolCat, setPoolCat] = useState('All');
  const [poolSearch, setPoolSearch] = useState('');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactCandidateId, setContactCandidateId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  // Jobs state
  const [jobCat, setJobCat] = useState('All');
  const [jobMode, setJobMode] = useState('All');
  const [jobSavedOnly, setJobSavedOnly] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobSort, setJobSort] = useState('new');
  const [openJobs, setOpenJobs] = useState({});
  const [appliedJobs, setAppliedJobs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tj_applied') || '{}');
    } catch {
      return {};
    }
  });
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tj_saved') || '{}');
    } catch {
      return {};
    }
  });

  // Apply dialog state
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [currentApplyJob, setCurrentApplyJob] = useState(null);
  const [applyName, setApplyName] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyResume, setApplyResume] = useState(null);
  const [applyPitch, setApplyPitch] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const flatViews = ['jobs', 'pool', 'how', 'contact', 'about', 'privacy', 'terms', 'legal'];
  const isFlat = flatViews.includes(currentView);

  // Deck counts
  const deckLengths = {
    companies: 3
  };
  const totalDeckSlides = deckLengths[currentView] || 1;

  const navigateTo = useCallback((v, slide = 0) => {
    if (v === 'jobs') {
      navigate('/open-roles');
      return;
    }
    setCurrentView(v);
    setSlideIdx(slide);
    try {
      window.history.replaceState(null, '', '#' + v);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    const el = document.getElementById('v-' + v);
    if (el) el.scrollTop = 0;
  }, [navigate]);

  // Listen to hash on mount
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.slice(1);
      const valid = ['home', 'companies', 'candidates', 'jobs', 'pool', 'how', 'contact', 'about', 'privacy', 'terms', 'legal'];
      if (h && valid.includes(h)) {
        navigateTo(h);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [navigateTo]);

  // Keyboard navigation for deck
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.querySelector('dialog[open]')) return;
      if (currentView === 'home' || isFlat) return;
      if (e.key === 'ArrowRight') {
        setSlideIdx((prev) => Math.min(prev + 1, totalDeckSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIdx((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        navigateTo('home');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, isFlat, totalDeckSlides, navigateTo]);

  // Persist local storage
  const toggleSaveJob = (id) => {
    setSavedJobs((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      try {
        localStorage.setItem('tj_saved', JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  const toggleJobAccordion = (id) => {
    setOpenJobs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openContact = (candidateId = '') => {
    setContactCandidateId(candidateId);
    setContactMsg(
      candidateId
        ? `I would like to access the full profile for candidate ${candidateId}.`
        : 'I would like to access full candidate profiles.'
    );
    setContactModalOpen(true);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    const body = `Name: ${contactName}\nEmail: ${contactEmail}\n\n${contactMsg}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      'Candidate pool enquiry'
    )}&body=${encodeURIComponent(body)}`;
    setContactModalOpen(false);
  };

  const openApplyModal = (job) => {
    setCurrentApplyJob(job);
    setApplyName('');
    setApplyPhone('');
    setApplyEmail('');
    setApplyResume(null);
    setApplyPitch('');
    setApplyError('');
    setApplySuccess(false);
    setApplyModalOpen(true);
  };

  const handleApplySubmit = (e) => {
    e.preventDefault();
    if (!applyName.trim()) {
      setApplyError('Please enter your name.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(applyEmail.trim())) {
      setApplyError('Please enter a valid email address.');
      return;
    }
    if (!applyResume) {
      setApplyError('Please attach your resume.');
      return;
    }
    if (applyResume.size > 5 * 1024 * 1024) {
      setApplyError('That file is over 5 MB. Please attach a smaller one.');
      return;
    }
    setApplyError('');
    setApplySubmitting(true);
    setTimeout(() => {
      setAppliedJobs((prev) => {
        const next = { ...prev, [currentApplyJob.id]: 1 };
        try {
          localStorage.setItem('tj_applied', JSON.stringify(next));
        } catch { }
        return next;
      });
      setApplySubmitting(false);
      setApplySuccess(true);
    }, 800);
  };

  // Intersection observer for rv classes in home view
  useEffect(() => {
    const root = document.getElementById('v-home');
    if (!root) return;
    const els = root.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { root, threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [currentView]);

  // Candidates filtering
  const poolCats = ['All', 'Engineering', 'Data', 'Design', 'QA', 'DevOps'];
  const filteredCandidates = P_DATA.filter((c) => {
    if (poolCat !== 'All' && c.cat !== poolCat) return false;
    const t = poolSearch.trim().toLowerCase();
    return (
      !t ||
      (c.role + ' ' + c.loc + ' ' + c.mode + ' ' + c.sk.join(' ')).toLowerCase().includes(t)
    );
  });

  // Jobs filtering & sorting
  const jobCats = ['All', 'Engineering', 'Data', 'Design', 'QA', 'DevOps', 'Marketing'];
  const jobModes = ['All', 'Remote', 'Hybrid', 'On-site'];
  const filteredJobs = J_DATA.filter((j) => {
    if (jobCat !== 'All' && j.cat !== jobCat) return false;
    if (jobMode !== 'All' && j.mode !== jobMode) return false;
    if (jobSavedOnly && !savedJobs[j.id]) return false;
    const t = jobSearch.trim().toLowerCase();
    return (
      !t ||
      (j.t + ' ' + j.ind + ' ' + j.loc + ' ' + j.mode + ' ' + j.type + ' ' + j.sk.join(' '))
        .toLowerCase()
        .includes(t)
    );
  });

  filteredJobs.sort((a, b) => {
    if (jobSort === 'short') return (a.mo || 99) - (b.mo || 99);
    if (jobSort === 'long') return (b.mo || 99) - (a.mo || 99);
    return a.d - b.d;
  });

  const scrollToTop = () => {
    const el = document.querySelector('.tj-landing-root .view.on .pg, .tj-landing-root .view.on .pool, .tj-landing-root #v-home');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reusable footer component
  const Footer = ({ ctaTitle, ctaBtn1, ctaBtn2 }) => (
    <footer className="ftr">
      <div className="fi">
        <div className="fcta">
          <h2 dangerouslySetInnerHTML={{ __html: ctaTitle || 'Hire smarter.<br><em>Work better.</em>' }} />
          <div className="fbtns">
            {ctaBtn1 && (
              <button
                className={`fb ${ctaBtn1.light ? 'light' : ''}`}
                onClick={() => (ctaBtn1.action ? ctaBtn1.action() : navigateTo(ctaBtn1.view))}
              >
                {ctaBtn1.label}
              </button>
            )}
            {ctaBtn2 && (
              <button
                className={`fb ${ctaBtn2.light ? 'light' : ''}`}
                onClick={() => (ctaBtn2.action ? ctaBtn2.action() : navigateTo(ctaBtn2.view))}
              >
                {ctaBtn2.label}
              </button>
            )}
          </div>
        </div>
        <div className="fgrid">
          <div className="fbrand">
            <div className="brand">
              <LogoSvg />
              Term Jobs
            </div>
            <p>Verified contract and permanent talent, matched and managed in one place.</p>
            <address>
              Hilite Business Park<br />
              Kozhikode, Kerala, India
            </address>
          </div>
          <div>
            <h4>Explore</h4>
            <button onClick={() => navigateTo('companies')}>Companies</button>
            <button onClick={() => navigateTo('jobs')}>Candidates</button>
            <button onClick={() => navigateTo('jobs')}>Open roles</button>
            <button onClick={() => navigateTo('pool')}>Candidate pool</button>
          </div>
          <div>
            <h4>Company</h4>
            <button onClick={() => navigateTo('about')}>About</button>
            <button onClick={() => navigateTo('how')}>How we work</button>
            <button onClick={() => navigateTo('contact')}>Contact</button>
          </div>
          <div>
            <h4>Legal</h4>
            <button onClick={() => navigateTo('privacy')}>Privacy Policy</button>
            <button onClick={() => navigateTo('terms')}>Terms &amp; Conditions</button>
            <button onClick={() => navigateTo('legal')}>Legal notice</button>
          </div>
          <div>
            <h4>Get in touch</h4>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <a href="tel:+919400352440">+91 94003 52440</a>
            <a href="https://www.instagram.com/termjobsofficial/" target="_blank" rel="noopener noreferrer">
              Instagram @termjobsofficial
            </a>
          </div>
        </div>
        <div className="fcopy">
          <span>&copy; 2026 TermJobs. All rights reserved.</span>
          <button onClick={scrollToTop}>Back to top ↑</button>
        </div>
      </div>
    </footer>
  );

  return (
    <div className={`tj-landing-root ${isFlat ? 'flat' : ''} ${currentView}`}>
      {/* Top Chrome Header */}
      <div className="chrome top">
        <button className="logo" onClick={() => navigateTo('home')} aria-label="TermJobs home">
          <LogoSvg />
          <span>Term Jobs</span>
        </button>
        <div className="switch">
          <button
            onClick={() => navigateTo('how')}
            aria-current={currentView === 'how'}
          >
            How we work
          </button>
          <button
            onClick={() => navigateTo('contact')}
            aria-current={currentView === 'contact'}
          >
            Contact
          </button>
        </div>
      </div>

      {/* Bottom Deck Navigation */}
      {currentView !== 'home' && !isFlat && (
        <div className="chrome bottom">
          <span id="count">
            0{slideIdx + 1} / 0{totalDeckSlides}
          </span>
          <div className="nav">
            <button
              id="back"
              disabled={slideIdx === 0}
              onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
            <button
              id="next"
              disabled={slideIdx === totalDeckSlides - 1}
              onClick={() => setSlideIdx((i) => Math.min(totalDeckSlides - 1, i + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* VIEW: HOME */}
      <section className={`view ${currentView === 'home' ? 'on' : ''}`} id="v-home" aria-label="Choose your path">
        <div className="hs">
          <main className="th" id="th" data-mode={heroMode}>
            <div className="th-in">
              <div className="th-tg" role="tablist" aria-label="I am a">
                <span className="th-pill" aria-hidden="true"></span>
                <button
                  role="tab"
                  id="tt-cand"
                  aria-selected={heroMode === 'cand'}
                  aria-controls="tp-cand"
                  tabIndex={heroMode === 'cand' ? 0 : -1}
                  onClick={() => setHeroMode('cand')}
                >
                  Candidate
                </button>
                <button
                  role="tab"
                  id="tt-hire"
                  aria-selected={heroMode === 'hire'}
                  aria-controls="tp-hire"
                  tabIndex={heroMode === 'hire' ? 0 : -1}
                  onClick={() => setHeroMode('hire')}
                >
                  Hiring manager
                </button>
              </div>

              <div className="th-stage">
                {heroMode === 'hire' ? (
                  <div className="th-p on" id="tp-hire" role="tabpanel" aria-labelledby="tt-hire">
                    <h1>
                      Hire the right people, <em>faster.</em>
                    </h1>
                    <p className="th-s">
                      Tell us who you need. We shortlist verified contract talent and have them ready to start within two weeks.
                    </p>
                    <div className="th-a">
                      <button className="th-b pri" onClick={() => navigateTo('companies')}>
                        I&rsquo;m hiring <i>&rarr;</i>
                      </button>
                      <button className="th-b sec" onClick={() => navigateTo('pool')}>
                        Browse candidate pool
                      </button>
                    </div>
                    <ul className="th-f">
                      <li><b>01</b><span>Share your requirement</span></li>
                      <li><b>02</b><span>Receive a vetted shortlist</span></li>
                      <li><b>03</b><span>Onboard in two weeks</span></li>
                    </ul>
                  </div>
                ) : (
                  <div className="th-p on" id="tp-cand" role="tabpanel" aria-labelledby="tt-cand">
                    <h1>
                      Get matched with verified companies, <em>on your terms.</em>
                    </h1>
                    <p className="th-s">
                      Share your skills once. We match you with verified companies hiring for contract and permanent roles, so you stop applying into the void.
                    </p>
                    <div className="th-a">
                      <button className="th-b pri" onClick={() => navigate('/talent-waitlist')}>
                        Join the talent pool, it's free <i aria-hidden="true">&rarr;</i>
                      </button>
                    </div>
                    <p className="th-note">Takes 2 minutes · No fees · Matched to roles that fit</p>
                  </div>
                )}
              </div>
            </div>
          </main>

          <div className="mq" aria-hidden="true">
            <div className="mqt">
              <span>Data Engineers</span><span>UX Designers</span><span>QA Automation</span><span>DevOps</span><span>Full-Stack Engineers</span><span>Cloud Architects</span><span>Data Analysts</span><span>Product Designers</span>
              <span>Data Engineers</span><span>UX Designers</span><span>QA Automation</span><span>DevOps</span><span>Full-Stack Engineers</span><span>Cloud Architects</span><span>Data Analysts</span><span>Product Designers</span>
            </div>
          </div>

          <section className="sec">
            <div className="wrap">
              <p className="eyebrow rv">How it works</p>
              <h2 className="big rv">
                From requirement to invoice, <em>in one place.</em>
              </h2>
              <div className="hw">
                <div className="hc rv">
                  <span className="n">01</span>
                  <div>
                    <b>Tell us what you need</b>
                    <span>A role, a duration, a start date. That is all we ask for.</span>
                  </div>
                </div>
                <div className="hc rv" style={{ transitionDelay: '.12s' }}>
                  <span className="n">02</span>
                  <div>
                    <b>We source and verify</b>
                    <span>Screened, verified professionals matched to your requirement.</span>
                  </div>
                </div>
                <div className="hc rv" style={{ transitionDelay: '.24s' }}>
                  <span className="n">03</span>
                  <div>
                    <b>Start sooner, manage easily</b>
                    <span>Timesheets, approvals and billing handled on one platform.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="two2">
            <div className="pn l">
              <div>
                <small className="rv">For companies</small>
                <h3 className="rv">Skip the hiring delay.</h3>
                <ul className="rv">
                  <li>Post a requirement in minutes</li>
                  <li>Get a verified shortlist</li>
                  <li>Track timesheets and billing</li>
                </ul>
              </div>
              <button className="btn rv" onClick={() => navigateTo('companies')}>
                I’m hiring
              </button>
            </div>
            <div className="pn r">
              <div>
                <small className="rv">For candidates</small>
                <h3 className="rv">Roles that actually fit.</h3>
                <ul className="rv">
                  <li>One profile, matched roles</li>
                  <li>Clear duration and work mode</li>
                  <li>Paid on time, tracked end to end</li>
                </ul>
              </div>
              <button className="btn rv" onClick={() => navigateTo('jobs')}>
                Browse open roles
              </button>
            </div>
          </section>

          <Footer
            ctaTitle="Not sure where to start?<br><em>Just talk to us.</em>"
            ctaBtn1={{ label: 'Contact us', view: 'contact', light: true }}
            ctaBtn2={{ label: 'How we work', view: 'how' }}
          />
        </div>
      </section>

      {/* VIEW: COMPANIES */}
      <section className={`view ${currentView === 'companies' ? 'on' : ''}`} id="v-companies" aria-label="For companies">
        <div className="deck">
          <div className="track" style={{ transform: `translateX(-${slideIdx * 100}vw)` }}>
            <div className={`slide ${slideIdx === 0 ? 'act' : ''}`}>
              <div>
                <h1>Build your team. <em>Without the hiring delay.</em></h1>
                <p className="lede">
                  Share what you need. TermJobs finds, screens and delivers verified contract talent, so your project starts sooner.
                </p>
                <button className="btn" onClick={() => setSlideIdx(2)}>Post a requirement</button>
                <button className="link" onClick={() => setSlideIdx(1)}>What you get</button>
                <button className="link" onClick={() => navigateTo('pool')}>Search candidate pool</button>
              </div>
              <div className="vis">
                <div className="stack">
                  <div className="mc req" style={{ '--i': 0 }}>
                    <small>Requirement</small>
                    <b>Senior Data Engineer</b>
                    <small>8 months · Remote · Starts in 2 weeks</small>
                  </div>
                  <div className="mc" style={{ '--i': 1 }}>
                    <div className="who">
                      <i className="av">AK</i>
                      <div>
                        <b>Data Engineer · 9 yrs</b>
                        <small>Pune · Available in 1 week</small>
                      </div>
                    </div>
                    <span className="ok">Verified</span>
                  </div>
                  <div className="mc" style={{ '--i': 2 }}>
                    <div className="who">
                      <i className="av">SR</i>
                      <div>
                        <b>Data Engineer · 7 yrs</b>
                        <small>Bengaluru · Available now</small>
                      </div>
                    </div>
                    <span className="ok">Verified</span>
                  </div>
                  <div className="mc" style={{ '--i': 3 }}>
                    <div className="who">
                      <i className="av">MV</i>
                      <div>
                        <b>Data Engineer · 11 yrs</b>
                        <small>Remote · Available in 2 weeks</small>
                      </div>
                    </div>
                    <span className="ok">Verified</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`slide ${slideIdx === 1 ? 'act' : ''}`}>
              <div>
                <h1>One place, from requirement to invoice.</h1>
                <div className="rows">
                  <div className="row">
                    <b>Requirements</b>
                    <span>Create requisitions and track every active engagement.</span>
                  </div>
                  <div className="row">
                    <b>Timesheets</b>
                    <span>Hours and attendance, approved without spreadsheets.</span>
                  </div>
                  <div className="row">
                    <b>Billing</b>
                    <span>Costs and invoices visible as they happen.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`slide ${slideIdx === 2 ? 'act' : ''}`}>
              <div>
                <h1>Tell us what you need.</h1>
                <p className="lede">A role, a duration, a start date. We’ll come back with a shortlist.</p>
                <button className="btn" onClick={() => navigateTo('contact')}>Post a requirement</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VIEW: CANDIDATES */}
      {/* (Candidate deck replaced - candidates now navigates directly to Open Roles) */}

      {/* VIEW: JOBS (OPEN ROLES) */}
      <section className={`view ${currentView === 'jobs' ? 'on' : ''}`} id="v-jobs" aria-label="Open roles">
        <div className="pool">
          <div className="in">
            <p className="eyebrow">For candidates</p>
            <h1>Open roles.</h1>
            <p className="lede">
              Contract and permanent roles from verified companies. Search, read the details, and apply in under a minute.
            </p>
            <div className="jtools">
              <div className={`sw ${jobSearch ? 'has' : ''}`} id="jsw">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="9" cy="9" r="6" />
                  <path d="m14 14 4 4" />
                </svg>
                <input
                  className="srch"
                  id="jq"
                  type="search"
                  placeholder="Search by role, skill or city"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  aria-label="Search open roles"
                  autoComplete="off"
                />
                <button className="clr" onClick={() => setJobSearch('')} aria-label="Clear search">
                  &times;
                </button>
              </div>
              <select
                className="sel"
                id="jsort"
                value={jobSort}
                onChange={(e) => setJobSort(e.target.value)}
                aria-label="Sort roles"
              >
                <option value="new">Newest first</option>
                <option value="short">Shortest contract</option>
                <option value="long">Longest contract</option>
              </select>
            </div>

            <div className="frow">
              <div className="chips" id="jcat" role="group" aria-label="Filter by area">
                <span className="flab">Area</span>
                {jobCats.map((c) => (
                  <button
                    key={c}
                    className="chip"
                    aria-pressed={jobCat === c}
                    onClick={() => setJobCat(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="chips" id="jmode" role="group" aria-label="Filter by work mode">
                <span className="flab">Mode</span>
                {jobModes.map((m) => (
                  <button
                    key={m}
                    className="chip"
                    aria-pressed={jobMode === m}
                    onClick={() => setJobMode(m)}
                  >
                    {m}
                  </button>
                ))}
                <button
                  className="chip"
                  aria-pressed={jobSavedOnly}
                  onClick={() => setJobSavedOnly(!jobSavedOnly)}
                >
                  Saved
                </button>
              </div>
            </div>

            <div className="cnt" id="jcnt" aria-live="polite">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'open role' : 'open roles'}
              {Object.keys(appliedJobs).length > 0 && ` · ${Object.keys(appliedJobs).length} applied`}
            </div>

            <div className="jlist" id="jlist">
              {filteredJobs.map((j) => {
                const isOpen = !!openJobs[j.id];
                const isApplied = !!appliedJobs[j.id];
                const isSaved = !!savedJobs[j.id];
                return (
                  <article key={j.id} className={`jb2 ${isOpen ? 'open' : ''}`} data-id={j.id}>
                    <div
                      className="jh"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      onClick={() => toggleJobAccordion(j.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleJobAccordion(j.id);
                        }
                      }}
                    >
                      <div>
                        <h3>{j.t}</h3>
                        <p className="jm">
                          {j.ind} · {j.mode} · {j.loc}
                        </p>
                      </div>
                      <p className="js">{j.sum}</p>
                      <div className="jr">
                        {j.d <= 2 && <span className="pill new">New</span>}
                        <span className="pill">{j.mo ? `${j.mo} months` : 'Permanent'}</span>
                        {isApplied ? (
                          <span className="jbtn done">Applied</span>
                        ) : (
                          <button
                            className="jbtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApplyModal(j);
                            }}
                          >
                            Apply <span aria-hidden="true">&rarr;</span>
                          </button>
                        )}
                        <span className="chev" aria-hidden="true">
                          <ChevSvg />
                        </span>
                      </div>
                    </div>

                    <div className="jd">
                      <div>
                        <div className="jdi">
                          <div>
                            <h4>About the role</h4>
                            <p>{j.about}</p>
                            <h4>What you will do</h4>
                            <ul>
                              {j.do.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                            <h4>What you bring</h4>
                            <ul>
                              {j.need.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                            <div className="tags">
                              {j.sk.map((k) => (
                                <span key={k}>{k}</span>
                              ))}
                            </div>
                          </div>

                          <aside className="side">
                            <dl className="facts">
                              <dt>Type</dt>
                              <dd>{j.type}</dd>
                              <dt>Duration</dt>
                              <dd>{j.mo ? `${j.mo} months` : 'Permanent'}</dd>
                              <dt>Pay</dt>
                              <dd>{j.pay}</dd>
                              <dt>Start</dt>
                              <dd>{j.start}</dd>
                              <dt>Experience</dt>
                              <dd>{j.exp}</dd>
                              <dt>Openings</dt>
                              <dd>{j.op}</dd>
                              <dt>Posted</dt>
                              <dd>{j.d <= 1 ? 'Today' : `${j.d} days ago`}</dd>
                              <dt>Ref</dt>
                              <dd>{j.id}</dd>
                            </dl>
                            <div className="acts">
                              {isApplied ? (
                                <span className="jbtn done">Applied</span>
                              ) : (
                                <button
                                  className="jbtn solid"
                                  onClick={() => openApplyModal(j)}
                                >
                                  Apply now <span aria-hidden="true">&rarr;</span>
                                </button>
                              )}
                              <button
                                className="sv"
                                aria-pressed={isSaved}
                                aria-label="Save role"
                                onClick={() => toggleSaveJob(j.id)}
                              >
                                <BookmarkSvg />
                              </button>
                            </div>
                          </aside>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredJobs.length === 0 && (
              <p className="empty" style={{ display: 'block' }}>
                No roles match that search. Try a different skill or city, or{' '}
                <button onClick={() => navigateTo('contact')} className="ul">
                  send us your profile
                </button>{' '}
                and we will match you.
              </p>
            )}
          </div>

          <Footer
            ctaTitle="Don’t see your role?<br><em>Send us your profile.</em>"
            ctaBtn1={{ label: 'Get in touch', view: 'contact', light: true }}
            ctaBtn2={{ label: 'I’m hiring', view: 'companies' }}
          />
        </div>
      </section>

      {/* VIEW: CANDIDATE POOL */}
      <section className={`view ${currentView === 'pool' ? 'on' : ''}`} id="v-pool" aria-label="Candidate pool">
        <div className="pool">
          <div className="in">
            <h1>Search the <em>candidate pool.</em></h1>
            <p className="lede">
              Verified contract professionals, ready to start. Browse experience, location and skills. Names and contact details are shared once you get in touch.
            </p>
            <div className="note">
              <span>
                Names and contact details are hidden. Contact us to unlock full profiles and get a shortlist for your requirement.
              </span>
              <button className="pbtn" onClick={() => openContact()}>
                Contact us <i style={{ fontStyle: 'normal' }}>&rarr;</i>
              </button>
            </div>
            <div className="tools">
              <input
                className="srch"
                id="q"
                type="search"
                placeholder="Search by role, skill or city"
                aria-label="Search candidates"
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
              />
              <div className="chips" id="chips" role="group" aria-label="Filter by area">
                {poolCats.map((cat) => (
                  <button
                    key={cat}
                    className="chip"
                    aria-pressed={poolCat === cat}
                    onClick={() => setPoolCat(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="cnt" id="cnt" aria-live="polite">
              {filteredCandidates.length} {filteredCandidates.length === 1 ? 'candidate' : 'candidates'}
            </div>
            <div className="grid" id="grid">
              {filteredCandidates.map((c) => (
                <article key={c.id} className="cd">
                  <div className="hd">
                    <span className="ph" aria-hidden="true"></span>
                    <div className="id">
                      <span className="nm" aria-hidden="true">Firstname Lastname</span>
                      <div className="ref">
                        <LockSvg />
                        Ref {c.id}
                      </div>
                    </div>
                  </div>
                  <h3>{c.role}</h3>
                  <dl className="facts">
                    <dt>Experience</dt>
                    <dd>{c.yrs} years</dd>
                    <dt>Location</dt>
                    <dd>{c.loc} · {c.mode}</dd>
                    <dt>Availability</dt>
                    <dd>{c.av}</dd>
                  </dl>
                  <div className="tags">
                    {c.sk.map((k) => (
                      <span key={k}>{k}</span>
                    ))}
                  </div>
                  <div className="ft">
                    <span className="vf">Verified</span>
                    <div className="lock">
                      <LockSvg />
                      Name, contact details and resume are hidden
                    </div>
                    <button className="pbtn dk" onClick={() => openContact(c.id)}>
                      Contact us to access details
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {filteredCandidates.length === 0 && (
              <p className="empty" style={{ display: 'block' }}>
                No candidates match that search. Try a different skill or city, or contact us and we will find someone for you.
              </p>
            )}
          </div>

          <Footer
            ctaTitle="Found the right fit?<br><em>Let’s talk.</em>"
            ctaBtn1={{ label: 'Contact us', action: () => openContact(), light: true }}
            ctaBtn2={{ label: 'I’m hiring', view: 'companies' }}
          />
        </div>
      </section>

      {/* VIEW: HOW WE WORK */}
      <section className={`view ${currentView === 'how' ? 'on' : ''}`} id="v-how" aria-label="How we work">
        <div className="pg">
          <div className="in">
            <p className="eyebrow">How it works</p>
            <h1>One platform for the complete <em>workforce journey.</em></h1>
            <ol className="steps">
              <li style={{ '--i': 0 }}><span className="n">01</span><b>Requirement</b></li>
              <li style={{ '--i': 1 }}><span className="n">02</span><b>Sourcing</b></li>
              <li style={{ '--i': 2 }}><span className="n">03</span><b>Interview</b></li>
              <li style={{ '--i': 3 }}><span className="n">04</span><b>Selection</b></li>
              <li style={{ '--i': 4 }}><span className="n">05</span><b>Contract lifecycle</b></li>
              <li style={{ '--i': 5 }}><span className="n">06</span><b>Renew / Offboard</b></li>
            </ol>
            <p className="lede">
              From requirement to invoice — with an intelligent layer running quietly across every stage, and people still making the decisions that matter.
            </p>
            <button className="btn" onClick={() => navigateTo('contact')}>
              Get in touch
            </button>
          </div>

          <Footer
            ctaTitle="Ready to start?<br><em>Tell us what you need.</em>"
            ctaBtn1={{ label: 'Post a requirement', view: 'contact', light: true }}
            ctaBtn2={{ label: 'Browse open roles', view: 'jobs' }}
          />
        </div>
      </section>

      {/* VIEW: CONTACT */}
      <section className={`view ${currentView === 'contact' ? 'on' : ''}`} id="v-contact" aria-label="Contact">
        <div className="pg">
          <div className="in">
            <p className="eyebrow">Contact</p>
            <h1>Get in <em>touch.</em></h1>
            <p className="lede">
              Hiring, looking for work, or just have a question? Write or call us and a real person will get back to you.
            </p>
            <div className="ct">
              <div className="ctl">
                <a className="ctc" href={`mailto:${CONTACT_EMAIL}`}>
                  <span className="ci">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <span className="ctt">
                    <small>Email</small>
                    <b>{CONTACT_EMAIL}</b>
                  </span>
                  <i className="ar">↗</i>
                </a>
                <a className="ctc" href="tel:+919400352440">
                  <span className="ci">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                    </svg>
                  </span>
                  <span className="ctt">
                    <small>Phone</small>
                    <b>+91 94003 52440</b>
                  </span>
                  <i className="ar">↗</i>
                </a>
                <a className="ctc" href="https://www.instagram.com/termjobsofficial/" target="_blank" rel="noopener noreferrer">
                  <span className="ci">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17" cy="7" r=".6" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="ctt">
                    <small>Instagram</small>
                    <b>@termjobsofficial</b>
                  </span>
                  <i className="ar">↗</i>
                </a>
                <div className="ctc ctoff">
                  <span className="ci">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                  </span>
                  <span className="ctt">
                    <small>Office</small>
                    <b>Hilite Business Park<br />Kozhikode, Kerala, India</b>
                  </span>
                </div>
              </div>
              <div className="ctm">
                <iframe
                  title="TermJobs office on Google Maps"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  src="https://maps.google.com/maps?q=Hilite+Business+Park,+Kozhikode,+Kerala&amp;z=15&amp;output=embed"
                ></iframe>
                <div className="ctbar">
                  <span>
                    <b>Hilite Business Park</b>
                    <small>Kozhikode, Kerala</small>
                  </span>
                  <a
                    className="jbtn solid"
                    href="https://www.google.com/maps/dir/?api=1&amp;destination=Hilite+Business+Park+Kozhikode"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <Footer />
        </div>
      </section>

      {/* VIEW: ABOUT */}
      <section className={`view ${currentView === 'about' ? 'on' : ''}`} id="v-about" aria-label="About">
        <div className="pg">
          <div className="in doc">
            <p className="eyebrow">About</p>
            <h1>About <em>TermJobs.</em></h1>
            <p className="lede" style={{ maxWidth: 'none' }}>
              TermJobs connects companies with verified contract professionals, and professionals with contract roles.
            </p>
            <h2>One platform for the complete workforce journey</h2>
            <p>
              From requirement to invoice, TermJobs covers sourcing, interviews, selection and the contract lifecycle, through to renewal or offboarding. An intelligent layer runs quietly across every stage, and people still make the decisions that matter.
            </p>
            <h2>Where we are</h2>
            <p>Hilite Business Park, Kozhikode, Kerala, India.</p>
            <p>
              <button onClick={() => navigateTo('contact')} className="ul">
                Get in touch
              </button>
            </p>
          </div>
          <Footer />
        </div>
      </section>

      {/* VIEW: PRIVACY */}
      <section className={`view ${currentView === 'privacy' ? 'on' : ''}`} id="v-privacy" aria-label="Privacy Policy">
        <div className="pg">
          <div className="in doc">
            <p className="eyebrow">Legal</p>
            <h1>Privacy <em>Policy.</em></h1>
            <p className="upd">Last updated: 18 November 2026</p>
            <p>This policy explains how TermJobs handles personal information when you use this website.</p>
            <h2>Information we collect</h2>
            <ul>
              <li>Details you give us when you contact us, such as your name, email address, phone number and message.</li>
              <li>Professional details you share about a requirement or your experience, such as role, skills, location and availability.</li>
              <li>Basic technical data, such as browser type and pages visited, where analytics are used.</li>
            </ul>
            <h2>How we use it</h2>
            <ul>
              <li>To reply to your enquiries and provide our services.</li>
              <li>To match requirements with suitable contract professionals.</li>
              <li>To maintain and improve the website and keep it secure.</li>
            </ul>
            <h2>Sharing</h2>
            <p>
              We do not sell personal information. Candidate names and contact details are hidden in the candidate pool and are shared with a company only through TermJobs. We may use service providers who process data on our behalf, or disclose information where the law requires it.
            </p>
            <h2>Retention and your choices</h2>
            <p>
              We keep information only as long as needed for the purposes above or as required by law. You can ask to access, correct or delete your information by writing to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <h2>Contact</h2>
            <p>
              TermJobs, Hilite Business Park, Kozhikode, Kerala, India. Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, phone +91 94003 52440.
            </p>
          </div>
          <Footer />
        </div>
      </section>

      {/* VIEW: TERMS */}
      <section className={`view ${currentView === 'terms' ? 'on' : ''}`} id="v-terms" aria-label="Terms and Conditions">
        <div className="pg">
          <div className="in doc">
            <p className="eyebrow">Legal</p>
            <h1>Terms &amp; <em>Conditions.</em></h1>
            <p className="upd">Last updated: 18 November 2026</p>
            <p>By using this website you agree to these terms. If you do not agree, please do not use it.</p>
            <h2>Our service</h2>
            <p>
              TermJobs is a platform that helps companies find contract professionals and helps professionals find contract roles. Engagements, rates and contract terms are agreed in writing for each assignment.
            </p>
            <h2>Your responsibilities</h2>
            <ul>
              <li>Give accurate and up-to-date information.</li>
              <li>Do not misuse the website, attempt unauthorised access, or scrape or copy candidate data.</li>
              <li>Do not contact candidates outside TermJobs to avoid the process described on the site.</li>
            </ul>
            <h2>Intellectual property</h2>
            <p>The TermJobs name, logo and site content belong to TermJobs. You may not reuse them without written permission.</p>
            <h2>Disclaimer and liability</h2>
            <p>
              The website and its content are provided as is. Candidate listings are indicative and subject to availability. To the extent the law allows, TermJobs is not liable for indirect or consequential losses arising from use of the website.</p>
            <h2>Changes and governing law</h2>
            <p>We may update these terms from time to time. They are governed by the laws of India.</p>
            <h2>Contact</h2>
            <p>
              Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
          <Footer />
        </div>
      </section>

      {/* VIEW: LEGAL */}
      <section className={`view ${currentView === 'legal' ? 'on' : ''}`} id="v-legal" aria-label="Legal">
        <div className="pg">
          <div className="in doc">
            <p className="eyebrow">Legal</p>
            <h1>Legal <em>notice.</em></h1>
            <h2>Website operator</h2>
            <p>
              TermJobs<br />
              Hilite Business Park, Kozhikode, Kerala, India<br />
              Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br />
              Phone: <a href="tel:+919400352440">+91 94003 52440</a>
            </p>
            <h2>Content</h2>
            <p>
              We take care to keep the information on this website accurate, but we do not guarantee that it is complete or current.
            </p>
            <h2>Related policies</h2>
            <p>
              <button onClick={() => navigateTo('privacy')} className="ul">
                Privacy Policy
              </button>{' '}
              and{' '}
              <button onClick={() => navigateTo('terms')} className="ul">
                Terms &amp; Conditions
              </button>.
            </p>
          </div>
          <Footer />
        </div>
      </section>

      {/* CONTACT MODAL */}
      {contactModalOpen && (
        <dialog className="dlg" open aria-labelledby="dt">
          <h2 id="dt">Contact us</h2>
          <p id="dp">
            {contactCandidateId
              ? `Request details for ${contactCandidateId}. We will get back to you shortly.`
              : 'Tell us what you need and we will share full profiles.'}
          </p>
          <form onSubmit={handleContactSubmit}>
            <label htmlFor="cn">Your name</label>
            <input
              id="cn"
              required
              autoComplete="name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <label htmlFor="ce">Work email</label>
            <input
              id="ce"
              type="email"
              required
              autoComplete="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <label htmlFor="cm">Message</label>
            <textarea
              id="cm"
              value={contactMsg}
              onChange={(e) => setContactMsg(e.target.value)}
            />
            <div className="row2">
              <button className="pbtn dk" type="submit">
                Send request
              </button>
              <button className="x" type="button" onClick={() => setContactModalOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      )}

      {/* APPLY MODAL */}
      {applyModalOpen && currentApplyJob && (
        <dialog className="dlg" open aria-labelledby="adt">
          {!applySuccess ? (
            <div id="aform">
              <span className="jmeta" id="ameta">
                {currentApplyJob.id} · {currentApplyJob.ind} · {currentApplyJob.mode} ·{' '}
                {currentApplyJob.mo ? `${currentApplyJob.mo} months` : 'Permanent'}
              </span>
              <h2 id="adt">Apply: {currentApplyJob.t}</h2>
              <p>Takes about a minute. We share your profile with the hiring team only for this role.</p>
              <form onSubmit={handleApplySubmit} noValidate>
                <div className="two">
                  <div>
                    <label htmlFor="an">Full name</label>
                    <input
                      id="an"
                      required
                      autoComplete="name"
                      value={applyName}
                      onChange={(e) => setApplyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="ap">Phone</label>
                    <input
                      id="ap"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+91"
                      value={applyPhone}
                      onChange={(e) => setApplyPhone(e.target.value)}
                    />
                  </div>
                </div>
                <label htmlFor="ae">Email</label>
                <input
                  id="ae"
                  type="email"
                  required
                  autoComplete="email"
                  value={applyEmail}
                  onChange={(e) => setApplyEmail(e.target.value)}
                />
                <label htmlFor="ar">Resume</label>
                <input
                  id="ar"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setApplyResume(e.target.files[0] || null)}
                />
                <p className="hint">PDF or Word, up to 5 MB.</p>
                <label htmlFor="am">
                  Why are you a fit? <span style={{ opacity: 0.6 }}>(optional)</span>
                </label>
                <textarea
                  id="am"
                  placeholder="A couple of lines is plenty."
                  value={applyPitch}
                  onChange={(e) => setApplyPitch(e.target.value)}
                />
                {applyError && (
                  <p className="err" role="alert">
                    {applyError}
                  </p>
                )}
                <div className="row2">
                  <button className="pbtn dk" type="submit" disabled={applySubmitting}>
                    {applySubmitting ? 'Sending…' : 'Submit application'}
                  </button>
                  <button className="x" type="button" onClick={() => setApplyModalOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="jdone">
              <div className="ck">✓</div>
              <h2>Application sent.</h2>
              <p id="adm">
                Thanks {applyName.split(' ')[0]}. We have received your application for {currentApplyJob.t} ({currentApplyJob.id}). Our team will email you at {applyEmail} within 2 working days.
              </p>
              <button className="pbtn dk" type="button" onClick={() => setApplyModalOpen(false)}>
                Back to roles
              </button>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
