-- Optional demo data. Do not run this file if you are importing real data.
insert into public.farmers
(bp_number,farmer_name,phone,village,estate,employee_name,cluster,team,day,route_group,visit_date,latitude,longitude,remarks)
values
('IN4C5-BP1000-VC1000','Ravi Kumar','9876543210','Madikeri','Estate A','Employee 1','C01','Team 1','1','Route A','2026-09-07',12.4245,75.7380,''),
('IN4C5-BP1001-VC1001','Suresh P','9876543211','Madikeri','Estate A','Employee 1','C01','Team 1','1','Route A','2026-09-07',12.4280,75.7420,''),
('IN4C5-BP1002-VC1002','Manoj K','9876543212','Madikeri','Estate B','Employee 1','C01','Team 1','1','Route A','2026-09-07',12.4215,75.7440,''),
('IN4C5-BP1003-VC1003','Kiran B','9876543213','Madikeri','Estate B','Employee 1','C01','Team 2','2','Route B','2026-09-08',12.4160,75.7360,''),
('IN4C5-BP1004-VC1004','Ramesh M','9876543214','Madikeri','Estate C','Employee 2','C02','Team 2','2','Route B','2026-09-08',12.4470,75.7660,''),
('IN4C5-BP1005-VC1005','Ajith N','9876543215','Madikeri','Estate C','Employee 2','C02','Team 2','2','Route B','2026-09-08',12.4510,75.7710,''),
('IN4C5-BP1006-ABC1006','Anil S','9876543216','Madikeri','Estate D','Employee 3','C02','Team 3','3','Route C','2026-09-09',12.4430,75.7760,''),
('IN4C5-BP1007-ABC1007','Prakash R','9876543217','Madikeri','Estate D','Employee 3','C03','Team 3','3','Route C','2026-09-09',12.3890,75.7000,''),
('IN4C5-BP1008-ABC1008','Dinesh G','9876543218','Madikeri','Estate E','Employee 3','C03','Team 3','3','Route C','2026-09-09',12.3940,75.7070,''),
('IN4C5-BP1009-ABC1009','Naveen C','9876543219','Madikeri','Estate E','Employee 3','C03','Team 4','4','Route D','2026-09-10',12.4000,75.7120,''),
('IN4C5-BP1010-VC1010','Sunil V','9876543220','Madikeri','Estate F','Employee 4','C04','Team 4','4','Route D','2026-09-10',12.4700,75.7000,''),
('IN4C5-BP1011-VC1011','Harish K','9876543221','Madikeri','Estate F','Employee 4','C04','Team 4','4','Route D','2026-09-10',12.4760,75.7060,'')
on conflict(bp_number) do update set
farmer_name=excluded.farmer_name,phone=excluded.phone,village=excluded.village,
estate=excluded.estate,employee_name=excluded.employee_name,cluster=excluded.cluster,team=excluded.team,day=excluded.day,
route_group=excluded.route_group,visit_date=excluded.visit_date,
latitude=excluded.latitude,longitude=excluded.longitude,remarks=excluded.remarks,updated_at=now();

insert into public.completed_farmers(bp_number,remarks)
values ('IN4C5-BP1000-VC1000','Demo completed'),('IN4C5-BP1002-VC1002','Demo completed'),
('IN4C5-BP1006-ABC1006','Demo completed'),('IN4C5-BP1010-VC1010','Demo completed')
on conflict(bp_number) do nothing;

-- A few representative points from the supplied Cluster_Map.html format.
insert into public.cluster_points(cluster,team,day,latitude,longitude,color)
values
('12','Team 1','1',12.741449,75.761295,'#4db68c'),
('12','Team 1','1',12.729926,75.745699,'#4db68c'),
('21','Team 2','29',13.13043,75.64172,'#f28410'),
('77','Team 2','6',13.326186,75.319776,'#d4071c'),
('77','Team 2','6',13.326337,75.320174,'#d4071c'),
('77','Team 2','6',13.3328499,75.3119227,'#d4071c'),
('10','Team 2','31',13.118041,75.640476,'#816060'),
('10','Team 2','31',13.1202,75.638548,'#816060'),
('67','Team 2','35',13.113353,75.577573,'#281422'),
('67','Team 2','35',13.12147,75.580403,'#281422'),
('39','Team 1','43',13.077648,75.553618,'#ca5ffe'),
('53','Team 1','27',13.0182634,75.7376211,'#d1e96b'),
('53','Team 1','27',13.0275381,75.7303486,'#d1e96b'),
('55','Team 2','42',13.0933999,75.6790226,'#8bc835'),
('55','Team 2','42',13.091532,75.68004,'#8bc835'),
('44','Team 1','34',13.0443386,75.7062252,'#6fdc93'),
('44','Team 1','34',13.065061,75.70048,'#6fdc93'),
('72','Team 1','7',12.817387,75.784564,'#966c58'),
('72','Team 1','7',12.815559,75.785298,'#966c58'),
('18','Team 1','35',13.0589507,75.6089224,'#1fecfa'),
('18','Team 1','35',13.0534947,75.6081039,'#1fecfa'),
('30','Team 1','19',12.9914321,75.7089765,'#5485c5'),
('30','Team 1','19',12.963478,75.689442,'#5485c5'),
('15','Team 1','18',12.9719761,75.8848656,'#0391b3'),
('15','Team 1','18',12.977055,75.852148,'#0391b3'),
('5','Team 1','26',13.015703,75.766609,'#516fb5'),
('5','Team 1','26',13.037473,75.765521,'#516fb5'),
('81','Team 2','27',13.142567,75.654546,'#a3f6ae'),
('81','Team 2','27',13.149227,75.665135,'#a3f6ae'),
('23','Team 2','18',13.177912,75.720573,'#57d0c6'),
('23','Team 2','18',13.18334,75.72799,'#57d0c6'),
('8','Team 2','26',13.14142,75.43457,'#4dbe43'),
('8','Team 2','26',13.15073,75.42603,'#4dbe43'),
('19','Team 2','19',13.193296,75.614339,'#77e38a'),
('19','Team 2','19',13.192745,75.611999,'#77e38a'),
('17','Team 2','17',13.194078,75.472568,'#e37a7d'),
('17','Team 2','17',13.194954,75.472467,'#e37a7d'),
('45','Team 2','34',13.11684,75.662101,'#6c19b8'),
('45','Team 2','34',13.116226,75.659626,'#6c19b8'),
('42','Team 2','10',13.245886,75.541244,'#c485c4'),
('42','Team 2','10',13.2477171,75.5415922,'#c485c4');
