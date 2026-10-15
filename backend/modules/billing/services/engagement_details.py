"""Resolve billing parties from linked business records, never the acting admin."""


def resolve_engagement(db, wo):
    agreement = wo.get('agreement_data') or {}
    req_id = wo.get('requisition_id') or agreement.get('requisition_id')
    req = (db['requisitions'].find_one({'id': req_id}) or {}) if req_id else {}
    profile_id = req.get('company_profile_id') or wo.get('company_profile_id')
    profile = (db['company_profiles'].find_one({'id': profile_id}) or {}) if profile_id else {}
    company = profile.get('name') or req.get('client_name') or req.get('company_name') or agreement.get('companyName') or wo.get('company_name') or ''
    return {
        'company_name': company,
        'vendor_name': agreement.get('supplierName') or wo.get('vendor_name') or '',
        'reporting_to': agreement.get('reportingTo') or wo.get('hiring_manager_name') or wo.get('reporting_manager') or '',
        'place_of_work': agreement.get('placeOfWork') or wo.get('work_location') or wo.get('location') or '',
        'msa_ref': agreement.get('msaRef') or wo.get('msa_ref') or '',
    }
