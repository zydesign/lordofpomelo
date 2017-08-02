https://github.com/zydesign/lordofpomelo/tree/master/web-server__resources__["/clientManager.js"] = {
  meta: {
    mimetype: "application/javascript"
  },
  data: function(exports, require, module, __filename, __dirname) {
    var heroSelectView = require('heroSelectView');  // role manager 角色管理器

    var pomelo = window.pomelo;
    var app = require('app');
    var EntityType = require('consts').EntityType;
    var Message = require('consts').MESSAGE;
    var loginMsgHandler = require('loginMsgHandler');
    var gameMsgHandler = require('gameMsgHandler');
    var switchManager = require('switchManager');
    var clientManager = require('clientManager');
    var dataApi = require('dataApi');
    var ResourceLoader = require('resourceLoader');
    var utils = require('utils');
    var config = require('config');

    var alert = window.alert;
    var self = this;

    var loading = false;
    //location为全局变量，是javascript里边管理地址栏的内置对象
    //location.href	完整的 URL;  location.hash为标签页
    var httpHost = location.href.replace(location.hash, '');

    pomelo.on('websocket-error', function(){
      loading = false;
    });

    function init() {
      //bind events  按钮事件监听  ，登陆按钮、注册按钮、创建角色按钮
      $('#loginBtn').on('click', login);
      $('#registerBtn').on('click', register);
      $('#heroSelectBtn').on('click', createPlayer);
      //oauth button 授权按钮
      $('#authBtn li a').on('click', function () {
        var $a = $(this);
        var url = $a.attr('href');
        if (url && url !== '#') {
          window.open(window.location.origin + url, "auth", "toolbar=0,status=0,resizable=1,width=620,height=450,left=200,top=200");
        }
        return false;
      });

      // go to register 跳转到注册界面按钮
      $('#id_toRegisterBnt').on('click', function() {
        $('#id_loginFrame').addClass('f-dn');
        $('#id_registerFrame').removeClass('f-dn');
        return false;
      });

      // back button 返回按钮
      $('#id_registerFrame .bg3').on('click', function() {
        $('#id_loginFrame').removeClass('f-dn');
        $('#id_registerFrame').addClass('f-dn');
        return false;
      });
    }

    /**
     * login 登录按钮的回调函数
     * 输入用户名、密码，并验证
     */
    function login() {
      if (loading) {
        return;
      }
      ////点击按钮后。先切换到正在请求状态，关闭请求接口，避免重复请求
      loading = true;
      var username = $('#loginUser').val().trim();
      var pwd = $('#loginPwd').val().trim();
      $('#loginPwd').val('');
      if (!username) {
        alert("Username is required!");
        //请求错误，切换回可请求状态
        loading = false;
        return;
      }

      if (!pwd) {
        alert("Password is required!");
        //请求错误，切换回可请求状态
        loading = false;
        return;
      }

      //点击登录按钮时，通过用户名和密码，请求登录，返回data进行操作
      $.post(httpHost + 'login', {username: username, password: pwd}, function(data) {
        if (data.code === 501) {
          alert('Username or password is invalid!');
          loading = false;
          return;
        }
        if (data.code !== 200) {
          alert('Username is not exists!');
          loading = false;
          return;
        }

        //登录游戏，读取用户信息
        authEntry(data.uid, data.token, function() {
          loading = false;
        });
        localStorage.setItem('username', username);
      });
    }

    //连接gate服务器
    function queryEntry(uid, callback) {
      //链接配件文件的gate端口，访问gate服务器，得到data数据(得到分配的connector的IP和port，然后断开与gate的链接)
      pomelo.init({host: config.GATE_HOST, port: config.GATE_PORT, log: true}, function() {
        pomelo.request('gate.gateHandler.queryEntry', { uid: uid}, function(data) {
          pomelo.disconnect();

          if(data.code === 2001) {
            alert('Servers error!');
            return;
          }

          callback(data.host, data.port);
        });
      });
    }

    /**
     * enter game server  登录游戏是用token登录的,在connector服务器解析成uid+时间戳
     * route: connector.entryHandler.entry
     * response：
     * {
     *   code: [Number],
     *   player: [Object]
     * }
     */
    //连接connector服务器，绑定session到服务器,返回data数据，初始化登录信息和游戏信息
    function entry(host, port, token, callback) {
      // init socketClient
      // TODO for development
      if(host === '127.0.0.1') {
        host = config.GATE_HOST;
      }
      //连接connector，获取用户信息并绑定session到服务器上，返回data包含：code、player
      pomelo.init({host: host, port: port, log: true}, function() {
        pomelo.request('connector.entryHandler.entry', {token: token}, function(data) {
          var player = data.player;

          if (callback) {
            callback(data.code);
          }

          if (data.code == 1001) {
            alert('Login fail!');
            return;
          } else if (data.code == 1003) {
            alert('Username not exists!');
            return;
          }

          if (data.code != 200) {
            alert('Login Fail!');
            return;
          }

          // init handler
          //初始化登录信息和游戏信息
          loginMsgHandler.init();
          gameMsgHandler.init();

          //角色进入验证
          if (!player || player.id <= 0) {
            //如果没有角色，进入角色选择界面指向1号框
            switchManager.selectView("heroSelectPanel");
          } else {
            //如果有角色，通过角色信息登录游戏
            afterLogin(data);
          }
        });
      });
    }

    //验证登录函数。先连接gate，然后连接分配的connector，得到角色信息后登录游戏
    function authEntry(uid, token, callback) {
      queryEntry(uid, function(host, port) {
        entry(host, port, token, callback);
      });
    }

    pomelo.authEntry = authEntry;

    //register 注册按钮的回调函数
    function register() {
      if (loading) {
        return;
      }
      //点击按钮后。先切换到正在请求状态，关闭请求接口，避免重复请求
      loading = true;
      var name = $('#reg-name').val().trim();
      var pwd = $('#reg-pwd').val().trim();
      var cpwd = $('#reg-cpwd').val().trim();
      $('#reg-pwd').val('');
      $('#reg-cpwd').val('');
      if (name === '') {
        alert('Username is required!');
        //请求错误，切换回可请求状态
        loading = false;
        return;
      }
      if (pwd === '') {
        alert('Password is required!');
        loading = false;
        return;
      }
      if (pwd != cpwd) {
        alert('Entered passwords differ!');
        loading = false;
        return;
      }
      //点击注册按钮时，请求注册，返回data进行操作
      $.post(httpHost + 'register', {name: name, password: pwd}, function(data) {
        if (data.code === 501) {
          alert('Username already exists！');
          loading = false;
        } else if (data.code === 200) {
          authEntry(data.uid, data.token, function() {
            loading = false;
          });
        } else {
          alert('Register fail！');
          loading = false;
        }
      });
    }

    // createPlayer
    // 创建角色
    function createPlayer() {
      if (loading) {
        return;
      }
      var roleId = heroSelectView.getRoleId();
      var name = document.getElementById('gameUserName').value.trim();
      var pwd = "pwd";

      if (!name) {
        alert("Role name is required!");
        loading = false;
      } else if (name.length > 9) {
        alert("Role name's length is too long!");
        loading = false;
      } else {
        //如果角色名字合法，连接前端服务器创建角色
        pomelo.request("connector.roleHandler.createPlayer", {name: name, roleId: roleId}, function(data) {
          loading = false;
          if (data.code == 500) {
            alert("The name already exists!");
            return;
          }

          if (data.player.id <= 0) {
            switchManager.selectView("loginPanel");
          } else {
            afterLogin(data);
          }
        });
      }
    }

    function afterLogin(data) {
      var userData = data.user;
      var playerData = data.player;

      var areaId = playerData.areaId;
      var areas = {1: {map: {id: 'jiangnanyewai.png', width: 3200, height: 2400}, id: 1}};

      if (!!userData) {
        pomelo.uid = userData.id;
      }
      pomelo.playerId = playerData.id;
      pomelo.areaId = areaId;
      pomelo.player = playerData;
      loadResource({jsonLoad: true}, function() {
        //enterScene();
        gamePrelude();
      });
    }

    function gamePrelude() {
      switchManager.selectView("gamePrelude");
      var entered = false;
      $('#id_skipbnt').on('click', function() {
        if (!entered) {
          entered = true;
          enterScene();
        }
      });
      setTimeout(function(){
        if (!entered) {
          entered = true;
          enterScene();
        }
      }, 12000);
    }


    function loadResource(opt, callback) {
      switchManager.selectView("loadingPanel");
      var loader = new ResourceLoader(opt);
      var $percent = $('#id_loadPercent').html(0);
      var $bar = $('#id_loadRate').css('width', 0);
      loader.on('loading', function(data) {
        var n = parseInt(data.loaded * 100 / data.total, 10);
        $bar.css('width', n + '%');
        $percent.html(n);
      });
      loader.on('complete', function() {
        if (callback) {
          setTimeout(function(){
            callback();
          }, 500);
        }
      });

      loader.loadAreaResource();
    }

    function enterScene(){
      pomelo.request("area.playerHandler.enterScene", null, function(data){
        app.init(data);
      });
    }

    // checkout the moveAimation
    function move(args) {
      var path = [{x: args.startX, y: args.startY}, {x: args.endX, y: args.endY}];
      var map = app.getCurArea().map;
      var paths = map.findPath(args.startX, args.startY, args.endX, args.endY);
      if(!paths || !paths.path){
        return;
      }
      var curPlayer = app.getCurArea().getCurPlayer();

      var area = app.getCurArea();
      var sprite = curPlayer.getSprite();
      var totalDistance = utils.totalDistance(paths.path);
      var needTime = Math.floor(totalDistance / sprite.getSpeed() * 1000 + app.getDelayTime());
      var speed = totalDistance/needTime * 1000;
      sprite.movePath(paths.path, speed);
      pomelo.request('area.playerHandler.move', {path: paths.path}, function(result) {
        if(result.code === Message.ERR){
          console.warn('curPlayer move error!');
          sprite.translateTo(paths.path[0].x, paths.path[0].y);
        }
      });
      sprite.movePath(paths.path);
    }

    function launchAi(args) {
      var areaId = pomelo.areaId;
      var playerId = pomelo.playerId;
      var targetId = args.id;
      if (pomelo.player.entityId === targetId) {
        return;
      }
      var skillId = pomelo.player.curSkill;
      var area = app.getCurArea();
      var entity = area.getEntity(targetId);
      if (entity.type === EntityType.PLAYER || entity.type === EntityType.MOB) {
        if (entity.died) {
          return;
        }
        if (entity.type === EntityType.PLAYER) {
          var curPlayer = app.getCurPlayer();
          pomelo.emit('onPlayerDialog', {targetId: targetId, targetPlayerId: entity.id,
            targetTeamId: entity.teamId, targetIsCaptain: entity.isCaptain,
            myTeamId: curPlayer.teamId, myIsCaptain: curPlayer.isCaptain});
        } else if (entity.type === EntityType.MOB) {
          pomelo.request('area.fightHandler.attack',{targetId: targetId}, function() {});
        }
      } else if (entity.type === EntityType.NPC) {
        pomelo.notify('area.playerHandler.npcTalk',{areaId :areaId, playerId: playerId, targetId: targetId});
      } else if (entity.type === EntityType.ITEM || entity.type === EntityType.EQUIPMENT) {
        var curPlayer = app.getCurPlayer();
        var bag = curPlayer.bag;
        if (bag.isFull()) {
          curPlayer.getSprite().hintOfBag();
          return;
        }
        pomelo.request('area.playerHandler.pickItem',
          {areaId :areaId, playerId: playerId, targetId: targetId}, function() {});
      }
    }

    /**
     * amend the path of addressing
     * @param {Object} path   the path of addressing
     * @return {Object} path the path modified
     */
    function pathAmend(path) {
      var pathLength = path.length;
      for (var i = 0; i < pathLength-2; i ++) {
        var curPoint = path[i];
        var nextPoint = path[i+1];
        var nextNextponit = path[i+2];
        if (curPoint.x === nextPoint.x) {
          if (nextNextponit.x > nextPoint.x) {
            nextPoint.x += 1;
          } else {
            nextPoint.x -= 1;
          }
          path[i+1] = nextPoint;
        }
        if (curPoint.y === nextPoint.y) {
          if (nextNextponit.y > nextPoint.y) {
            nextPoint.y += 1;
          }else {
            nextPoint.y -= 1;
          }
          path[i+1] = nextPoint;
        }
      }
      return path;
    }


    // export object and interfaces
    exports.init = init;
    exports.entry = entry;
    exports.enterScene = enterScene;
    exports.move = move;
    exports.loadResource = loadResource;
    exports.launchAi = launchAi;

  }
};


