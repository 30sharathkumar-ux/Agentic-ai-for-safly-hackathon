from backend.models import create_db_and_tables, engine
from sqlmodel import Session
from backend.demo import seed_agents, run_demo_scenario, run_pentest

create_db_and_tables()
with Session(engine) as s:
    seed_agents(s)
    print("Agents seeded OK")
    result = run_demo_scenario(s)
    for step in result["steps"]:
        print(f"Step {step['step']}: {step['description']} => {step['status']}")

print("\n--- Pentest scenarios ---")
with Session(engine) as s:
    for sid in ["pt-01", "pt-02", "pt-03", "pt-04", "pt-05", "pt-06"]:
        r = run_pentest(s, sid)
        passed = r.get("pass", False)
        print(f"{sid}: {'PASS' if passed else 'FAIL'} | status={r['actual_status']}")

