var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

var db_config = require('../config/database.js');
var db = db_config.init();
db_config.connect(db);

/* GET home page. */
router.get('/', function (req, res, next) {
  var sex = "select case when u_sex = 'female' then 'female' when u_sex = 'male' then 'male' end as sex_group, count(*) as cnt from user group by sex_group"
  var age = "select case when age < 20 then '10대' when age < 30 then '20대' when age < 40 then '30대' when age < 50 then '40대' when age < 60 then '50대' when age < 70 then '60대' end as age_group, count(*) as cnt_age from (select Floor((CAST(REPLACE(CURRENT_DATE,'-','') AS UNSIGNED) - CAST(REPLACE(u_birthDay,'-','') AS UNSIGNED)) / 10000) as age from user)age group by age_group order by age_group;"
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
                  res.render('visualization', { title: 'visualization', city, gu, dong, Hospital, sex, age, vaccine, h_vaccine });
                });
              });
            });
          });
        });
      });
    });
  });
});


router.get('/join', function (req, res, next) {
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
        res.render('join', { title: 'join', city, gu, dong });
      });
    });
  }
  );
});

router.post('/join', function (req, res, next) {
  const password = bcrypt.hashSync(req.body.Password, 10);
  const user_info = [req.body.ID, req.body.Name, password, req.body.Phone, req.body.Sex, req.body.Email, req.body.Dong, req.body.Birthday];
  console.log(user_info);
  db.query('select * from user where u_id = ?', req.body.ID, (err, data) => {
    if (err)
        console.error(err);
    if (data.length == 0) {
      console.log('회원가입 성공');
      var sqlForInsertuser = "Insert into user(u_id,u_name,u_password,u_phonenum,u_sex,u_email,u_address,u_birthday) values(?,?,?,?,?,?,?,?)";
      db.query(sqlForInsertuser, user_info, function (err) {
        if (err)
          console.error(err);
        res.redirect('/login');
      });
    } else {
      console.log('회원가입 실패');
      res.send("<script>alert('이미 존재하는 아이디 입니다.');location.href='/join';</script>");
    }
  });
});

router.get('/login', function (req, res, next) {
  res.render('login', { title: 'login' });
});

router.post('/login', function (req, res, next) {
  password = req.body.Password;
  db.query('select u_password from user where u_id = ?', req.body.ID, (err, data) => {
    if (err)
      console.error(err);
    if (data.length == 0) {
      res.send("<script>alert('존재하지 않는 아이디입니다.');location.href='/login';</script>");
    } else if (req.session.user) {
      res.send("<script>alert('이미 로그인 되어있습니다..');location.href='/home';</script>");
    } else {
      console.log(data[0].u_password);
      const same = bcrypt.compareSync(password, data[0].u_password);
      console.log(same);
      if (same) {
        console.log('로그인 성공');
        req.session.user =
        {
          id: req.body.ID,
          authorized: true
        };
        res.redirect('/home');
      } else {
        res.send("<script>alert('비밀번호가 다릅니다.');location.href='/login';</script>");
      }
    }
  })
})

router.get('/logout', function (req, res, next) {
  if (req.session.user) {
    console.log('로그아웃 처리');
    req.session.destroy(
      function (err) {
        if (err) {
          res.write("<script>alert('logout error')</script>");
          res.write("<script>window.location=\"/home\"</script>");
          return;
        }
        console.log('세션 삭제 성공');
        res.redirect('/');
      }
    );
  } else {
    console.log('로그인 안되어 있음');
    res.redirect('/');
  }
});

router.get('/reservation', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sqlForCheck = "select * from reservation where u_id = ?;";
  db.query(sqlForCheck, [req.session.user.id], function (err, check) {
    if (err)
      console.error(err);
    if (check.length == 0) {
      var date = new Date();
      var year = date.getFullYear();
      var month = ("0" + (1 + date.getMonth())).slice(-2);
      var day = ("0" + date.getDate()).slice(-2);
      var today = year + "-" + month + "-" + day;
      var url = 'home/reserv/' + today;
      res.redirect(url);
    } else {
      res.send("<script>alert('이미 예약 정보가 있습니다.');location.href='/home';</script>");
    }
  })
});

router.get('/remainvaccineprocess', function (req, res, next) {
  if (!req.session.user) {
    res.send("<script>alert('로그인을 하십시오.');location.href='/login';</script>");
  }
  var sqlForCheck = "select * from reservation where u_id = ?;";
  var date = new Date();
  var year = date.getFullYear();
  var month = ("0" + (1 + date.getMonth())).slice(-2);
  var day = ("0" + date.getDate()).slice(-2);
  date = year + "-" + month + "-" + day;
  db.query(sqlForCheck, [req.session.user.id], function (err, reservation) {
    if (err)
      console.error(err);
    var r_date;
    if (reservation.length == 2 && reservation[1].r_check == 0) {
      r_date = new Date(reservation[1].r_date);
      var year = r_date.getFullYear();
      var month = ("0" + (1 + r_date.getMonth())).slice(-2);
      var day = ("0" + r_date.getDate()).slice(-2);
      r_date = year + "-" + month + "-" + day;
      console.log("r_date: " + r_date + " date: " + date);
      if (date < r_date) {
        res.send("<script>alert('1차 접종 후 3주후 백신 접종이 가능');location.href='/home';</script>");
      }
    } else if (reservation.length == 2 && reservation[1].r_check == 1) {
      res.send("<script>alert('접종이 완료된 상태입니다.');location.href='/home';</script>");
    } else {
      var url = '/home/remainvaccine/';
      res.redirect(url);
    }
  });
});

router.get('/datevisual', function (req, res, next) {
  var vaccine_complete = "select r_date, count(*) as cnt_2 from reservation where r_check=1 and Nth_injection = 1 group by r_date order by r_date;";
  var vaccine_1 = "select r_date, count(*) as cnt_1 from reservation where r_check=1 and Nth_injection = 0 group by r_date order by r_date;"
  db.query(vaccine_complete, function (err, vaccine_complete) {
    db.query(vaccine_1, function (err, vaccine_1){
    if (err)
      console.error(err);
    res.render('datevisual', { title: 'datevisual', vaccine_1, vaccine_complete });
  });
});
});

module.exports = router;

