"""Run: python -m tests.test_supabase_connection"""
from db.supabase import get_accounts


def main():
    accounts = get_accounts()
    print(f"Connected. Found {len(accounts)} active account(s):")
    for a in accounts:
        print(f"  - {a['name']} ({a['type']}, {a['currency']})")


if __name__ == "__main__":
    main()
