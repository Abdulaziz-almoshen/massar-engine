"""Synthetic ledger at the founder's stated scale: 200 campaigns, 3000 potential clients,
1000 of them onboarded (replied and tagged). Written to /tmp/fixture/*.json for Playwright to
serve by route interception — NOTHING is written to the real database or the deployed app."""
import json, os, random
random.seed(7)
os.makedirs("/tmp/fixture", exist_ok=True)
import time
NOW = int(time.time()*1000)
DAY = 86400000
CITIES = ["الرياض","جدة","الدمام","مكة","المدينة","الخبر","أبها","تبوك","القصيم","حائل","نجران","جازان"]
SIZES  = ["كبيرة","متوسطة","صغيرة"]
SECTORS= ["عيادات","صيدليات","مجمعات طبية","مستشفيات","مراكز أسنان","مختبرات","مراكز تجميل"]
PRODUCTS = ["الإجازات المرضية","فحص الموظفين","التقارير الطبية","خدمات التطعيمات",
            "الشهادات الصحية","تكامل الأنظمة (HIS/ERP)","سجل التطعيمات الوطني","صحة أعمال Plus"]
OUTCOMES = ["interested","scheduled","handoff","later","not_interested","closed","stopped"]
NAME_A = ["مجمع","مركز","عيادات","صيدلية","مستشفى","مختبر","مجموعة"]
NAME_B = ["النور","الشفاء","الأمل","السلام","الرعاية","الحياة","الوفاء","الصحة","اليسر","الربيع","المروج","الفيصل"]
NAME_C = ["الطبي","التخصصي","العام","لطب الأسنان","الجلدية","للتحاليل","الحديث",""]

def phone(i): return "9665" + str(10000000 + i * 7 % 89999999).zfill(8)

entities, contacts = [], []
for i in range(3000):
    nm = " ".join(x for x in (random.choice(NAME_A), random.choice(NAME_B), random.choice(NAME_C)) if x)
    entities.append({"id": i+1, "name": nm + (" " + str(i//300+1) if i % 300 == 0 else ""), "phone": phone(i),
        "attrs": {"المدينة": random.choice(CITIES), "الحجم": random.choice(SIZES), "القطاع": random.choice(SECTORS)}})

# 1000 onboarded = a real conversation, a delivered/read/replied ledger and at least one tag
for i in range(1000):
    e = entities[i]
    t0 = NOW - random.randint(1, 120) * DAY
    prod = random.choice(PRODUCTS)
    oc = random.choices(OUTCOMES + [None], weights=[26,14,9,11,9,5,4,22])[0]
    turns = [{"role":"agent","ts":t0,"text":"أرتق بكفاءة منشأتكم عبر " + prod + "؛ هل نعرض التفاصيل؟"},
             {"role":"customer","ts":t0+3600000,"text":random.choice(
                 ["نعم أرسلوا التفاصيل","كم السعر؟","نحتاج تكامل مع نظامنا","لاحقًا من فضلك","غير مهتم شكرًا","ما هي مدة التفعيل؟"])},
             {"role":"agent","ts":t0+3700000,"text":"سعدنا باهتمامكم — نرتب مكالمة قصيرة لمناقشة الربط."}]
    st = {"sent": t0, "delivered": t0+60000, "read": t0+900000, "replied": t0+3600000}
    tags = [{"product": prod, "level": random.choice(["hot","warm","cold"])}]
    if random.random() < .3: tags.append({"product": random.choice(PRODUCTS), "level": random.choice(["warm","cold"])})
    contacts.append({"phone": e["phone"], "waName": e["name"], "transcript": turns, "statusTimes": st,
        "tags": tags, "outcome": oc, "optedOut": oc == "stopped" and random.random() < .5,
        "lastEventAt": t0 + 3700000, "test": False, "human": random.random() < .04,
        "scheduledSaid": "الأحد صباحًا" if oc == "scheduled" else None,
        "outcomeReason": "طلب عرضًا تجاريًا مفصلًا" if oc else None})
# 700 more reached but silent
for i in range(1000, 1700):
    e = entities[i]
    t0 = NOW - random.randint(1, 90) * DAY
    contacts.append({"phone": e["phone"], "waName": e["name"],
        "transcript": [{"role":"agent","ts":t0,"text":"تعريف بخدمات لين الصحية."}],
        "statusTimes": {"sent": t0, "delivered": t0+60000, "read": t0+800000} if i % 3 else {"sent": t0},
        "tags": [], "outcome": None, "optedOut": False, "lastEventAt": t0, "test": False, "human": False})

camps = []
for i in range(200):
    created = NOW - random.randint(1, 150) * DAY
    n = random.choice([20, 40, 60, 80, 120, 200])
    start = random.randint(0, 1700 - n)
    camps.append({"id": 1000+i, "name": "حملة " + random.choice(PRODUCTS) + " — " + random.choice(CITIES) + " " + str(i+1),
        "product": random.choice(PRODUCTS), "created_at": created, "test": i % 17 == 0,
        "targets": [{"phone": entities[j]["phone"]} for j in range(start, start+n)]})

json.dump({"contacts": contacts, "notifyNumber": "966559402621"}, open("/tmp/fixture/state.json","w"), ensure_ascii=False)
json.dump(entities, open("/tmp/fixture/entities.json","w"), ensure_ascii=False)
json.dump(camps, open("/tmp/fixture/campaigns.json","w"), ensure_ascii=False)
print("contacts", len(contacts), "entities", len(entities), "campaigns", len(camps),
      "onboarded(replied)", sum(1 for c in contacts if c["statusTimes"].get("replied")))
