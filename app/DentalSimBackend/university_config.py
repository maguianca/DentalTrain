UNIVERSITY_DOMAINS = {
    "UMF Iuliu Hațieganu Cluj": ["umfcluj.ro", "elearn.umfcluj.ro"],
    "UMF Carol Davila București": ["umfcd.ro"],
    "UMF Grigore T. Popa Iași": ["umfiasi.ro", "email.umfiasi.ro"],
    "UMFST Târgu Mureș": ["umfst.ro", "stud.umfst.ro"],
    "UMF Victor Babeș Timișoara": ["umft.ro"],
    "Ovidius University Constanța": ["univ-ovidius.ro"],
    "Transilvania University Brașov": ["unitbv.ro", "student.unitbv.ro"],
    "Administrative Staff": ["gmail.com"]

}

def get_university_name(email_domain):
    for name, domains in UNIVERSITY_DOMAINS.items():
        if email_domain in domains:
            return name
    return None

def get_list_of_universities():
    return list(UNIVERSITY_DOMAINS.keys())