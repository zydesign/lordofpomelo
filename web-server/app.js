var express = require('express');
var Token = require('../shared/token');
var secret = require('../shared/config/session').secret;
var userDao = require('./lib/dao/userDao');
var app = express.createServer();
var mysql = require('./lib/dao/mysql/mysql');
var everyauth = require('./lib/oauth');

var publicPath = __dirname +  '/public';


//app是开启web服务器的总接口，主要运行clientManager的主入口函数，和配置服务器环境
app.configure(function() {
  app.use(express.methodOverride());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({ secret: "keyboard cat" }));
  app.use(everyauth.middleware());
  app.use(app.router);
  app.set('view engine', 'ejs');
  app.set('views', __dirname + '/views');
  app.set('view options', {layout: false});
  app.set('basepath', publicPath);
});

app.configure('development', function(){
  app.use(express.static(publicPath));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  var oneYear = 31557600000;
  app.use(express.static(publicPath, { maxAge: oneYear }));
  app.use(express.errorHandler());
});

app.get('/auth_success', function(req, res) {
  if (req.session.userId) {
    var token = Token.create(req.session.userId, Date.now(), secret);
    res.render('auth', {code: 200, token: token, uid: req.session.userId});
  } else {
    res.render('auth', {code: 500});
  }
});

//登录按钮监听（收到请求后会连接数据库获取user，通过Token模块创建Token，返回Token、uid）
app.post('/login', function(req, res) {
  var msg = req.body;

  console.log('msg: ',msg);
  var username = msg.username;
  var pwd = msg.password;
  if (!username || !pwd) {
    res.send({code: 500});
    return;
  }

//通过用户名请求数据库获取用户信息，并验证输入的密码是否跟数据库用户密码一致
  userDao.getUserByName(username, function(err, user) {
    if (err || !user) {
      console.log('username not exist!');
      res.send({code: 500});
      return;
    }
    if (pwd !== user.password) {
      // TODO code
      // password is wrong
      console.log('password incorrect!');
      res.send({code: 501});
      return;
    }

    console.log(username + ' login!');
	  //登录用户名和密码跟数据库匹配后，返回data数据
    res.send({code: 200, token: Token.create(user.id, Date.now(), secret), uid: user.id});
  });
});

//注册按钮监听
app.post('/register', function(req, res) {
  //console.log('req.params');
  var msg = req.body;
  if (!msg.name || !msg.password) {
    res.send({code: 500});
    return;
  }
//数据库创建用户，并返回该用户信息
  userDao.createUser(msg.name, msg.password, '', function(err, user) {
    if (err || !user) {
      console.error(err);
      if (err && err.code === 1062) {
        res.send({code: 501});
      } else {
        res.send({code: 500});
      }
    } else {
      console.log('A new user was created! --' + msg.name);
      res.send({code: 200, token: Token.create(user.id, Date.now(), secret), uid: user.id});
    }
  });
});

//Init mysql
//开启对象池链接数据库
mysql.init();

app.listen(3001);

// Uncaught exception handler
process.on('uncaughtException', function(err) {
	console.error(' Caught exception: ' + err.stack);
});

console.log("Web server has started.\n Please log on http://127.0.0.1:3001/");
