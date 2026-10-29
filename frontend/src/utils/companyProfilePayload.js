export function buildCompanyProfilePayload(company, admin, savedName) {
  const name = company.name.trim();
  return {
    ...(name !== savedName?.trim() ? { name } : {}),
    industry: company.industry,
    size: company.size,
    location: company.location.trim(),
    notes: company.notes.trim(),
    logo_url: company.logo_url,
    tech_stack: company.tech_stack,
    require_director_approval: company.require_director_approval,
    admin_name: admin.admin_name.trim(),
    admin_email: admin.admin_email.trim(),
    admin_phone: admin.admin_phone.trim(),
  };
}
