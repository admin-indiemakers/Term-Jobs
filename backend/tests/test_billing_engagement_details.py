from modules.billing.services.engagement_details import resolve_engagement


class Collection:
    def __init__(self, records):
        self.records = records

    def find_one(self, query):
        return next((r for r in self.records if all(r.get(k) == v for k, v in query.items())), None)


def test_linked_company_profile_and_agreement_supply_billing_parties():
    db = {
        'requisitions': Collection([{'id': 'req', 'company_profile_id': 'company'}]),
        'company_profiles': Collection([{'id': 'company', 'name': 'Actual Client'}]),
    }
    details = resolve_engagement(db, {
        'requisition_id': 'req', 'company_name': 'Old Client', 'vendor_name': 'Old Vendor',
        'agreement_data': {'supplierName': 'Actual Supplier', 'reportingTo': 'Manager', 'placeOfWork': 'Chennai'},
    })
    assert details['company_name'] == 'Actual Client'
    assert details['vendor_name'] == 'Actual Supplier'
    assert details['reporting_to'] == 'Manager'
    assert details['place_of_work'] == 'Chennai'


def test_missing_details_do_not_invent_business_parties():
    assert all(value == '' for value in resolve_engagement({}, {}).values())
