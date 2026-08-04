from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from backend.modules.candidate.router import router as candidate_router

app = FastAPI(
    title="TERMJOB API - Candidate Screening Agent",
    description="Vendor-facing hiring funnel: JD Intake -> Candidate Resume Screening -> Interview Setup",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(candidate_router)

@app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
def get_dashboard():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TERMJOB - Candidate Screening Agent Dashboard</title>
        <style>
            :root {
                --bg: #0f172a;
                --panel: #1e293b;
                --border: #334155;
                --primary: #3b82f6;
                --primary-hover: #2563eb;
                --accent: #10b981;
                --text: #f8fafc;
                --text-muted: #94a3b8;
                --danger: #ef4444;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: var(--bg);
                color: var(--text);
                margin: 0;
                padding: 20px;
            }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--border);
                margin-bottom: 24px;
            }
            .header h1 {
                margin: 0;
                font-size: 1.5rem;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .badge {
                background: #3b82f633;
                color: #60a5fa;
                border: 1px solid #3b82f666;
                padding: 4px 10px;
                border-radius: 9999px;
                font-size: 0.8rem;
            }
            .container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
            }
            .card {
                background: var(--panel);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 20px;
            }
            .card h2 {
                margin-top: 0;
                font-size: 1.1rem;
                border-bottom: 1px solid var(--border);
                padding-bottom: 10px;
                color: #60a5fa;
            }
            label {
                display: block;
                margin-top: 12px;
                font-size: 0.85rem;
                color: var(--text-muted);
            }
            input, textarea, select {
                width: 100%;
                padding: 10px;
                margin-top: 4px;
                background: #0f172a;
                border: 1px solid var(--border);
                border-radius: 6px;
                color: white;
                box-sizing: border-box;
                font-family: inherit;
            }
            button {
                background: var(--primary);
                color: white;
                border: none;
                padding: 10px 18px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                margin-top: 16px;
                transition: background 0.2s;
            }
            button:hover {
                background: var(--primary-hover);
            }
            .output-box {
                background: #090d16;
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 14px;
                margin-top: 12px;
                font-family: monospace;
                white-space: pre-wrap;
                max-height: 400px;
                overflow-y: auto;
                font-size: 0.85rem;
            }
            .fit-score {
                font-size: 2rem;
                font-weight: bold;
                color: var(--accent);
            }
            .flex-between {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            a.doc-link {
                color: var(--primary);
                text-decoration: none;
            }
            a.doc-link:hover {
                text-decoration: underline;
            }
            .tabs {
                display: flex;
                gap: 10px;
                margin-bottom: 16px;
            }
            .tab-btn {
                background: #0f172a;
                border: 1px solid var(--border);
                color: var(--text-muted);
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
            }
            .tab-btn.active {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🤖 TERMJOB — Candidate Screening Agent <span class="badge">MVP v1.0 (PDF Support)</span></h1>
            <div>
                <a href="/docs" target="_blank" class="doc-link">📖 FastAPI Interactive Docs (/docs)</a>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" id="singleTab" onclick="switchTab('single')">Single Resume Text</button>
            <button class="tab-btn" id="bulkTab" onclick="switchTab('bulk')">📄 Multiple PDF Resumes Upload</button>
        </div>

        <div class="container">
            <!-- Single Form -->
            <div class="card" id="singleFormCard">
                <h2>📥 Submit Single Candidate Resume</h2>
                <form id="screenForm">
                    <label>Candidate Full Name</label>
                    <input type="text" id="name" value="Rahul Sharma" required>

                    <label>Email Address</label>
                    <input type="email" id="email" value="rahul.sharma@example.com" required>

                    <label>Phone Number</label>
                    <input type="text" id="phone" value="+919876543210" required>

                    <label>Requisition ID</label>
                    <input type="text" id="req_id" value="req_python_dev" required>

                    <label>Resume Content (PDF Parsed Text)</label>
                    <textarea id="resume_text" rows="5" required>Senior Backend Engineer with 5 years experience in Python, FastAPI, PostgreSQL, Docker, and LangGraph.</textarea>

                    <button type="submit">🚀 Run Candidate Screening Agent</button>
                </form>
            </div>

            <!-- Bulk PDF Form -->
            <div class="card" id="bulkFormCard" style="display: none;">
                <h2>📁 Upload Multiple Resume PDFs</h2>
                <form id="bulkPdfForm">
                    <label>Requisition ID</label>
                    <input type="text" id="bulk_req_id" value="req_python_dev" required>

                    <label>Select Multiple PDF Files</label>
                    <input type="file" id="pdf_files" accept=".pdf" multiple required style="padding: 6px;">

                    <button type="submit">⚡ Process & Rank Multiple PDFs</button>
                </form>
            </div>

            <!-- Agent Screening Result -->
            <div class="card">
                <h2>📊 AI Screening Output & Audit Log</h2>
                <div id="resultContainer">
                    <p style="color: var(--text-muted);">Select PDFs or enter single candidate text and click <strong>Run Candidate Screening Agent</strong> to view real-time candidate scores & ranking.</p>
                </div>
            </div>
        </div>

        <script>
            function switchTab(mode) {
                if (mode === 'single') {
                    document.getElementById('singleFormCard').style.display = 'block';
                    document.getElementById('bulkFormCard').style.display = 'none';
                    document.getElementById('singleTab').classList.add('active');
                    document.getElementById('bulkTab').classList.remove('active');
                } else {
                    document.getElementById('singleFormCard').style.display = 'none';
                    document.getElementById('bulkFormCard').style.display = 'block';
                    document.getElementById('singleTab').classList.remove('active');
                    document.getElementById('bulkTab').classList.add('active');
                }
            }

            // Single Submission Form
            document.getElementById('screenForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const resultDiv = document.getElementById('resultContainer');
                resultDiv.innerHTML = '<p style="color: var(--primary);">⏳ Agent processing 7-step screening workflow...</p>';

                const payload = {
                    tenant_id: "tenant_default",
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value,
                    requisition_id: document.getElementById('req_id').value,
                    resume_text: document.getElementById('resume_text').value,
                    requisition_data: {
                        title: "Senior Backend Engineer",
                        must_have_skills: ["Python", "FastAPI", "PostgreSQL", "Docker"],
                        nice_to_have_skills: ["LangGraph", "Redis"],
                        seniority: "Senior"
                    }
                };

                try {
                    const res = await fetch('/api/candidate/screen', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    
                    const score = data.screening_output.overall_fit_score;
                    const rec = data.screening_output.recommendation;
                    const dup = data.screening_output.duplicate_flags.is_duplicate;

                    resultDiv.innerHTML = `
                        <div class="flex-between">
                            <div>
                                <span style="font-size: 0.85rem; color: var(--text-muted);">Fit Score:</span>
                                <div class="fit-score">${score} / 100</div>
                            </div>
                            <div>
                                <span class="badge" style="background: ${rec === 'SHORTLIST' ? '#10b98133' : '#ef444433'}; color: ${rec === 'SHORTLIST' ? '#34d399' : '#f87171'}">${rec}</span>
                            </div>
                        </div>

                        <p><strong>Submission Status:</strong> <span style="color: #60a5fa">${data.submission.status}</span></p>
                        <p><strong>Agent Workflow State:</strong> ${data.agent_status}</p>
                        <p><strong>Duplicate Status:</strong> ${dup ? '<span style="color:var(--danger)">⚠️ Duplicate Submission Detected!</span>' : '✅ Clear (No duplicate)'}</p>

                        <h3>Skills Evaluation:</h3>
                        <ul>
                            ${data.screening_output.skill_matches.map(s => `<li><strong>${s.skill}</strong>: ${s.candidate_has ? '✅ Matched' : '❌ Missing'} (${s.score}/10)</li>`).join('')}
                        </ul>

                        <button onclick="shortlistCandidate('${data.submission.id}')" style="background: var(--accent);">✅ Hiring Manager: Approve & Shortlist</button>

                        <div class="output-box">${JSON.stringify(data, null, 2)}</div>
                    `;
                } catch (err) {
                    resultDiv.innerHTML = `<p style="color: var(--danger)">Error running agent: ${err.message}</p>`;
                }
            });

            // Bulk PDF Upload Form
            document.getElementById('bulkPdfForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const resultDiv = document.getElementById('resultContainer');
                resultDiv.innerHTML = '<p style="color: var(--primary);">⏳ Parsing PDF files and running Candidate Screening Agent for each resume...</p>';

                const filesInput = document.getElementById('pdf_files');
                const reqId = document.getElementById('bulk_req_id').value;

                const formData = new FormData();
                formData.append('requisition_id', reqId);
                for (let file of filesInput.files) {
                    formData.append('files', file);
                }

                try {
                    const res = await fetch('/api/candidate/screen-bulk-pdfs', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();

                    resultDiv.innerHTML = `
                        <h3 style="color: #60a5fa">🏆 Ranked Candidate Screening Results (${data.total_screened} Resumes)</h3>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <thead>
                                <tr style="background: #0f172a; text-align: left;">
                                    <th style="padding: 8px; border: 1px solid var(--border);">Rank</th>
                                    <th style="padding: 8px; border: 1px solid var(--border);">File & Candidate</th>
                                    <th style="padding: 8px; border: 1px solid var(--border);">Fit Score</th>
                                    <th style="padding: 8px; border: 1px solid var(--border);">Recommendation</th>
                                    <th style="padding: 8px; border: 1px solid var(--border);">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.ranked_candidates.map((c, i) => `
                                    <tr>
                                        <td style="padding: 8px; border: 1px solid var(--border);">#${i + 1}</td>
                                        <td style="padding: 8px; border: 1px solid var(--border);">
                                            <strong>${c.candidate_name}</strong><br>
                                            <small style="color: var(--text-muted);">${c.filename} (${c.email})</small>
                                        </td>
                                        <td style="padding: 8px; border: 1px solid var(--border); color: var(--accent); font-weight: bold;">${c.fit_score} / 100</td>
                                        <td style="padding: 8px; border: 1px solid var(--border);">${c.recommendation}</td>
                                        <td style="padding: 8px; border: 1px solid var(--border);">
                                            <button onclick="shortlistCandidate('${c.submission_id}')" style="padding: 4px 8px; font-size: 0.75rem; background: var(--accent);">Shortlist</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div class="output-box">${JSON.stringify(data, null, 2)}</div>
                    `;
                } catch (err) {
                    resultDiv.innerHTML = `<p style="color: var(--danger)">Error processing PDFs: ${err.message}</p>`;
                }
            });

            async function shortlistCandidate(subId) {
                try {
                    const res = await fetch(`/api/candidate/submissions/${subId}/shortlist`, { method: 'POST' });
                    const data = await res.json();
                    alert(`Status updated! ${data.message}`);
                } catch (err) {
                    alert(`Error shortlisting: ${err.message}`);
                }
            }
        </script>
    </body>
    </html>
    """
