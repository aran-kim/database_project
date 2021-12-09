var express = require('express');
var router = express.Router();

var db_config = require('../config/database.js');
var db = db_config.init();
db_config.connect(db);

// 홈페이지 get
router.get('/', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sex = "select case when u_sex = 'female' then 'female' when u_sex = 'male' then 'male' end as sex_group, count(*) as cnt from user group by sex_group"
  var age = "select case when age < 20 then '10대' when age < 30 then '20대' when age < 40 then '30대' end as age_group, count(*) as cnt_age from (select Floor((CAST(REPLACE(CURRENT_DATE,'-','') AS UNSIGNED) - CAST(REPLACE(u_birthDay,'-','') AS UNSIGNED)) / 10000) as age from user)age group by age_group order by age_group;"
  var vaccine = "select v_type, concat(round(count(*)/(select count(*) from reservation) * 100,2)) as percentage from reservation group by v_type order by v_type;"
  var h_vaccine = "select h.h_name as hospital, v.pifizer as pifizer,  v.astrazeneca as astrazeneca, v.moderna as moderna from hospital as h, vaccine as v where h.h_id = v.h_id group by h.h_id;"
  var sqlForcity = "SELECT distinct city_id, city_name FROM address";
  var sqlForgu = "SELECT distinct gu_id, gu_name FROM address where city_id = '11'";
  var sqlFordong = "SELECT distinct dong_id, dong_name, gu_id FROM address";
  var sqlAllHospital = "SELECT h_name, h_dong, h_address from hospital";

  db.query(sex, function (err, sex) {
    if (err)
      console.error(err);
    db.query(age, function (err, age) {
      if (err)
        console.error(err);
      db.query(vaccine, function (err, vaccine) {
        if (err)
          console.error(err);
        db.query(h_vaccine, function (err, h_vaccine) {
          if (err)
            console.error(err);
          db.query(sqlForcity, function (err, city) {
            if (err)
              console.error(err);
            db.query(sqlForgu, function (err, gu) {
              if (err)
                console.error(err);
              db.query(sqlFordong, function (err, dong) {
                if (err)
                  console.error(err);
                db.query(sqlAllHospital, function (err, Hospital) {
                  if (err)
                    console.error(err);
                  res.render('home/visualization', { title: 'visualization', city, gu, dong, Hospital, sex, age, vaccine, h_vaccine });
                });
              });
            });
          });
        });
      });
    });
  });
});

router.get('/reserv/:r_date', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var date = req.params.r_date;
  if (date == 0) {
    date = new Date();
    var year = date.getFullYear();
    var month = ("0" + (1 + date.getMonth())).slice(-2);
    var day = ("0" + date.getDate()).slice(-2);
    date = year + "-" + month + "-" + day;
  }
  console.log(date);
  var sqlForHospital = 'select distinct h.h_id, h.h_name from vaccine v, hospital h where v.h_id = h.h_id and v.deadline >= ? and v.i_vaccine <= ? order by v.i_vaccine;'
  db.query(sqlForHospital, [date, date], function (err, hospital) {
    if (err)
      console.error(err);
    res.render('home/reserv', { title: 'reservation', hospital, date });
  })
});

//백신 종류, 예약 시간 선택 get
router.get('/reserv/:r_date/:h_id', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var date = req.params.r_date;
  var h_id = req.params.h_id;

  var sqlForTimeCount = "select count(*) cnt, r.time, r.v_type, r.r_date from reservation r, hospital h where r.time != '' and h.h_id = ? and r.r_date = ? group by r.v_type;";
  var sqlForVaccine = "select v.* , h_name from vaccine v, hospital h where h.h_id = v.h_id and h.h_id = ? and v.deadline >= ? and v.i_vaccine <= ? order by v.i_vaccine;";
  db.query(sqlForTimeCount, [h_id, date], function (err, timecnt) {
    if (err)
      console.error(err);
    db.query(sqlForVaccine, [h_id, date, date], function (err, vaccine) {
      if (err)
        console.error(err);
      res.render('home/reservv', { title: 'timecount', date, timecnt, vaccine: vaccine[0] });
    });
  });
});

//백신 예약 post
router.post('/reserv', function (req, res, next) {
  var u_id = req.session.user.id;
  var datas = [u_id, req.body.Hid, req.body.Rdate, req.body.Rtime, req.body.Vtype];
  var sqlForInsert = "insert into reservation (u_id, h_id, r_date, time, v_type) values (?,?,?,?,?);";
  db.query(sqlForInsert, datas, function (err, insert) {
    if (err)
      console.error(err);
    var vtype = req.body.Vtype;
    var sqlForUpdate = "update vaccine set " + vtype + " = " + vtype + " - 1 where h_id = ? and deadline >= ? and i_vaccine <= ? order by i_vaccine;";
    db.query(sqlForUpdate, [req.body.Hid, req.body.Rdate], function (err, update) {
      if (err)
        console.error(err);
    });
  });
  res.redirect('/home');
});

//병원측 백신 등록 get
router.get('/vupdate', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var user_id = req.session.user.id;
  var sql = "select * from hospital where u_id = ?";
  db.query(sql, user_id, function (err, hospital) {
    if (err)
      console.error(err);
    if (hospital.length == 0)
      res.send("<script>alert('등록한 병원이 없습니다.');location.href='/home';</script>");
    res.render('home/vupdate', { title: 'Vupdate', hospital: hospital[0] });
  })
});

//병원측 백신 등록 post
router.post('/vupdate', function (req, res, next) {

  var sqlInsertVaccine = "insert into vaccine(i_vaccine, h_id, pifizer, astrazeneca, moderna, deadline) values (?, ?, ?, ?, ?, ?);"
  var deadline = new Date(req.body.i_vacctine);
  deadline.setDate(deadline.getDate() + 30);
  var datas = [req.body.i_vacctine, req.body.Hid, req.body.pifizer, req.body.astrazeneca, req.body.moderna, deadline];
  console.log(datas);
  db.query(sqlInsertVaccine, datas, function (err, vaccine) {
    if (err)
      console.error(err);
  })
  res.redirect('/home');
});

//병원 등록 get
router.get('/hospital', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sqlForcity = "SELECT distinct city_id, city_name FROM address";
  var sqlForgu = "SELECT distinct gu_id, gu_name FROM address where city_id = '11'"
  var sqlFordong = "SELECT distinct dong_id, dong_name, gu_id FROM address"
  db.query(sqlForcity, function (err, city) {
    if (err)
      console.error(err);
    db.query(sqlForgu, function (err, gu) {
      if (err)
        console.error(err);
      db.query(sqlFordong, function (err, dong) {
        if (err)
          console.error(err);
        res.render('home/hospital', { title: 'hospital', city, gu, dong });
      });
    });
  });
});

// 병원 등록 post
router.post('/hospital', function (req, res, next) {
  const user_id = req.session.user.id;
  var h_location;
  var hospital_info;
  db.query('select * from address where dong_id =?', req.body.Dong, function (err, location) {
    if (err)
      console.error(err);
    h_location = location[0].city_name + " " + location[0].gu_name + " " + location[0].dong_name;
    hospital_info = [req.body.Hospital_name, req.body.Dong, h_location + " " + req.body.Address.replace(/\r/g, ""), req.body.Phone, user_id];
    var sqlForInsertStore = "Insert into hospital(h_name, h_dong, h_address, h_phonenum, u_id) values(?,?,?,?,?)";
    db.query(sqlForInsertStore, hospital_info, function (err) {
      if (err)
        console.error(err);
      res.redirect('/home');
    });
  });
});

//병원 접종 정보 get(예약자 접종 처리)
router.get('/vaccinated', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var user_id = req.session.user.id;
  var sql = "select * from hospital where u_id = ?";
  db.query(sql, user_id, function (err, hospital) {
    if (err)
      console.error(err);
    if (hospital.length == 0)
      res.send("<script>alert('등록한 병원이 없습니다.');location.href='/home';</script>");
    var sqlForCheck = 'select r.*, h.h_name, h.h_id from reservation r, hospital h where r.h_id = h.h_id and h.u_id = ? and r.r_check = 0;';
    db.query(sqlForCheck, req.session.user.id, function (err, reservation) {
      if (err)
        console.error(err);
      console.log(reservation);
      res.render('home/vaccinated', { title: 'vaccinated', reservation });
    });
  })

});

//예약자 접종 처리 post(2차 예약 자동)
router.post('/vaccinated', function (req, res, next) {
  var n_number = req.body.Ninjection;
  var u_id = req.body.Uid;
  var h_id = req.body.Hid;
  if (parseInt(n_number) == 1) {
    var sqlForUpdateRC = "update reservation set r_check = 1 where u_id = ? and h_id = ? and Nth_injection = 1;";
    db.query(sqlForUpdateRC, [u_id, h_id], function (err, updateRC) {
      if (err)
        console.error(err);
      res.send("<script>alert('2차 접종 완료');location.href='/home/vaccinated';</script>");
    })
  }
  else {
    var vtype = req.body.Vtype;
    var r_date = new Date(req.body.Rdate);
    if (vtype == 'pifizer')
      r_date.setDate(r_date.getDate() + 21);
    else
      r_date.setDate(r_date.getDate() + 28);
    var year = r_date.getFullYear();
    var month = ("0" + (1 + r_date.getMonth())).slice(-2);
    var day = ("0" + r_date.getDate()).slice(-2);
    r_date = year + "-" + month + "-" + day;
    console.log("vtype: " + vtype);
    console.log("rdate: " + r_date);
    var sqlForCheck = "select * from vaccine v , hospital h where v.h_id = h.h_id and h.h_id = ? and v.deadline >= ? and v.i_vaccine <= ? order by v.i_vaccine;";
    db.query(sqlForCheck, [h_id, r_date, r_date], function (err, check) {
      if (err)
        console.error(err);
      console.log("check: " + check[0]);
      if (check.length == 0) {
        res.send("<script>alert('우리 병원의 3주 후 백신이 부족');location.href='/home/vaccinated';</script>");
      }
      else {
        var dataI = [u_id, h_id, r_date, req.body.Rtime, vtype];
        var sqlForUpdateR = "update reservation set r_check = 1 where u_id = ? and h_id =? and Nth_injection = ?;";
        db.query(sqlForUpdateR, [u_id, h_id, n_number], function (err, updateR) {
          if (err)
            console.error(err);
          var sqlForInsert = "insert into reservation (u_id, h_id, Nth_injection, r_date, time, v_type) values (?, ?, 1, ?, ?, ?);";
          db.query(sqlForInsert, dataI, function (err, insert) {
            if (err)
              console.error(err);
            var sqlForUpdateV = "update vaccine set " + vtype + " = " + vtype + " - 1 where h_id = ? and deadline >= ? and i_vaccine <= ? order by i_vaccine;";
            db.query(sqlForUpdateV, [h_id, r_date, r_date], function (err, updateV) {
              if (err)
                console.error(err);
              console.log(updateV);
              res.send("<script>alert('2차 예약 완료');location.href='/home/vaccinated';</script>");
            });
          });
        });
      }
    })
  }
});

router.get('/remainvaccine', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sqlForHospital = 'select * from vaccine v, hospital h where v.h_id = h.h_id and v.deadline = ? ;'
  var date = new Date();
  var year = date.getFullYear();
  var month = ("0" + (1 + date.getMonth())).slice(-2);
  var day = ("0" + date.getDate()).slice(-2);
  date = year + "-" + month + "-" + day;
  db.query(sqlForHospital, date, function (err, hospital) {
    if (err)
      console.error(err);
    res.render('home/remainvaccine', { title: 'remain', hospital, date })
  });
});



//본인 백신 정보 확인 get
router.get('/check', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sqlForCheck = "select r.*, h.h_name from reservation r, hospital h where r.h_id = h.h_id and r.u_id=?;";
  db.query(sqlForCheck, req.session.user.id, function (err, check) {
    if (err)
      console.error(err);
    console.log(check);
    res.render('home/check', { title: 'check', check });
  });
});

//본인 백신 예약 변경 get(병원 선택)
router.get('/modify', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sqlForUpdateReservation = "select r.*, h.h_name from reservation r, hospital h where r.h_id = h.h_id and r.u_id=? and r.r_check = 0;";
  db.query(sqlForUpdateReservation, [req.session.user.id], function (err, reservation) {
    if (err)
      console.error(err);
    console.log(reservation);
    var Nth_injection = parseInt(reservation[0].Nth_injection);
    if (Nth_injection == 0) //1차 예약 변경
      var r_date = new Date();
    else //2차 예약 변경
      var r_date = new Date(reservation[0].r_date);
    var sqlForHospital = 'select * from vaccine v, hospital h where v.h_id = h.h_id and v.deadline >= ? and v.i_vaccine <= ?;'
    db.query(sqlForHospital, [r_date, r_date], function (err, hospital) {
      if (err)
        console.error(err);
      console.log(hospital);
      res.render('home/modify', { title: 'modify', reservation, hospital });
    });
  });
});

//본인 백신 예약 변경 get(병원 선택)
router.get('/modify/:r_date', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var date = req.params.r_date;
  console.log(date);
  var sqlForUpdateReservation = "select r.*, h.h_name from reservation r, hospital h where r.h_id = h.h_id and r.u_id=? order by r.Nth_injection;";
  db.query(sqlForUpdateReservation, [req.session.user.id], function (err, reservation) {
    if (err)
      console.error(err);
    console.log(reservation);
    if (reservation.length == 1) //1차 예약 변경
      var r_date = date;
    else { //2차 예약 변경
      var r_date = new Date(reservation[1].r_date);
      var year = r_date.getFullYear();
      var month = ("0" + (1 + r_date.getMonth())).slice(-2);
      var day = ("0" + r_date.getDate()).slice(-2);
      r_date = year + "-" + month + "-" + day;
      console.log("r_date: " + r_date + " date: " + date);
      if (date < r_date) {
        var url = '/home/modify/' + r_date;
        console.log(url);
        res.send("<script>alert('1차 접종 후 3주후 백신 접종이 가능');location.href='" + url + "';</script>");
      }
      else
        r_date = date;
      console.log(r_date);
    }
    var sqlForHospital = 'select distinct h.h_id, h.h_name from vaccine v, hospital h where v.h_id = h.h_id and v.deadline >= ? and v.i_vaccine <= ? order by v.i_vaccine;';
    db.query(sqlForHospital, [r_date, r_date], function (err, hospital) {
      if (err)
        console.error(err);
      console.log(hospital);
      res.render('home/modify', { title: 'modify', reservation, hospital, r_date });
    });
  });
});

//백신 예약 시간 변경 get
router.get('/modify/:r_date/:h_id', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var h_id = req.params.h_id;
  var date = req.params.r_date;
  var sqlForVtype = "select * from reservation where u_id = ?;";
  db.query(sqlForVtype, [req.session.user.id], function (err, Vtype) {
    if (err)
      console.error(err);
    var vtype = Vtype[0].v_type;
    var sqlForTimeCount = "select count(*) cnt, r.time, r.v_type, r.r_date from reservation r, hospital h where r.time != '' and h.h_id = ? and r.r_date = ? and r.v_type = ?;";
    var sqlForVaccine = "select v.* , h.h_name from vaccine v, hospital h where h.h_id = v.h_id and h.h_id = ? and v.deadline >= ? and v.i_vaccine <= ? order by v.i_vaccine;";
    db.query(sqlForTimeCount, [h_id, date, vtype], function (err, timecnt) {
      if (err)
        console.error(err);
      console.log(timecnt);
      db.query(sqlForVaccine, [h_id, date, date], function (err, vaccine) {
        if (err)
          console.error(err);
        console.log(vaccine);
        res.render('home/modifyv', { title: 'timecount', date, vtype, timecnt, vaccine: vaccine[0] });
      });
    });
  })
});

//백신 예약 변경 post
router.post('/modify', function (req, res, next) {
  var u_id = req.session.user.id;
  var sqlForReservationBefore = "select * from reservation where r_check = 0 and u_id = ?";
  db.query(sqlForReservationBefore, u_id, function (err, reservation) {
    if (err)
      console.error(err);
    var Brdate = reservation[0].r_date;
    var vtype = req.body.Vtype;
    var sqlForUpdateVp = "update vaccine set " + vtype + " = " + vtype + " + 1 where h_id = ? and deadline >= ? and i_vaccine <= ? order by i_vaccine;";
    db.query(sqlForUpdateVp, [req.body.Hid, Brdate, Brdate], function (err, updateVp) {
      if (err)
        console.error(err);
      var datas = [req.body.Rdate, req.body.Rtime, u_id];
      var sqlForUpdateR = "update reservation set r_date = ?, time = ? where u_id = ? and r_check = 0;";
      db.query(sqlForUpdateR, datas, function (err, updateR) {
        if (err)
          console.error(err);
        var sqlForUpdateVm = "update vaccine set " + vtype + " = " + vtype + " - 1 where h_id = ? and deadline >= ? and i_vaccine <= ? order by i_vaccine;";
        db.query(sqlForUpdateVm, [req.body.Hid, req.body.Rdate, req.body.Rdate], function (err, updateVm) {
          if (err)
            console.error(err);
        });
      });
    });
  });
  res.redirect('/home');
})

router.get('/datevisual', function (req, res, next) {
  var vaccine_complete = "select r_date, count(*) as cnt_2 from reservation where r_check=1 and Nth_injection = 1 group by r_date order by r_date;";
  var vaccine_1 = "select r_date, count(*) as cnt_1 from reservation where r_check=1 and Nth_injection = 0 group by r_date order by r_date;"
  db.query(vaccine_complete, function (err, vaccine_complete) {
    db.query(vaccine_1, function (err, vaccine_1){
    if (err)
      console.error(err);
    res.render('home/datevisual', { title: 'datevisual', vaccine_1, vaccine_complete });
  });
});
});

module.exports = router;