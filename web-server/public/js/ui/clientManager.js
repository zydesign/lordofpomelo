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

    
    //clientManager为客户端主要入口函数，游戏运行时被app调用运行
    
    pomelo.on('websocket-error', function(){
      loading = false;
    });

    //主监听入口，所有函数的调用始于监听事件，（在哪里调用这个函数？）
    function init() {
      //bind events  按钮事件监听  ，登陆按钮、注册按钮、创建角色按钮，注册相应的函数
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

      //点击登录按钮时，通过req{用户名和密码}，访问二级域名/login，返回data进行操作
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
            //如果没有角色，进入角色选择界面指向1号框，监听‘heroSelectBt’按钮，点击创建，就调用createPlayer()函数
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
    // 创建角色---------------------------------------------------------------------------------------------【创建角色】
    function createPlayer() {
      //如果登录占用，返回
      if (loading) {
        return;
      }
      var roleId = heroSelectView.getRoleId();                                //角色类型id
      var name = document.getElementById('gameUserName').value.trim();        //角色名
      var pwd = "pwd";

      
      //如果没有角色名
      if (!name) {
        alert("Role name is required!");
        loading = false;
       //如果角色名字符超过9个
      } else if (name.length > 9) {
        alert("Role name's length is too long!");
        loading = false;
      } else {
        //如果角色名字合法，连接前端服务器创建角色
        //返回cb：{code: consts.MESSAGE.RES, user: user, player: player} player为玩家实体
        pomelo.request("connector.roleHandler.createPlayer", {name: name, roleId: roleId}, function(data) {
          loading = false;
          if (data.code == 500) {
            alert("The name already exists!");
            return;
          }

          //playerId为0，说明角色没创建成功
          if (data.player.id <= 0) {
            switchManager.selectView("loginPanel");  //显示创建角色面板
          } else {
         //如果请求创建角色成功，加载资源后登录场景
            afterLogin(data);
          }
        });
      }
    }

    //稍后登录。先加载场景资源，然后播放剧情动画，最后进入场景
    function afterLogin(data) {
      var userData = data.user;
      var playerData = data.player;

      var areaId = playerData.areaId;
      var areas = {1: {map: {id: 'jiangnanyewai.png', width: 3200, height: 2400}, id: 1}};  //默认的登录场景数据

      //将部分信息存到pomelo本地，类似于session--------------------------------------------------配置pomelo属性
      if (!!userData) {
        pomelo.uid = userData.id;
      }
      pomelo.playerId = playerData.id;
      pomelo.areaId = areaId;
      pomelo.player = playerData;
      //加载资源，播放剧情，登录场景
      loadResource({jsonLoad: true}, function() {
        //enterScene();
        gamePrelude();
      });
    }

    //显示游戏剧情，然后进入场景---------------------------------------------------------------------【显示游戏剧情】
    function gamePrelude() {
      switchManager.selectView("gamePrelude");   //显示剧情文字面板
      var entered = false;
      $('#id_skipbnt').on('click', function() {  //监听skip按钮，直接跳过剧情，进入场景
        if (!entered) {
          entered = true;
          enterScene();
        }
      });
      setTimeout(function(){         //12秒后自动进入场景 enterScene()
        if (!entered) {
          entered = true;
          enterScene();
        }
      }, 12000);
    }


    //加载资源--------------------------------------------------------------------------------------【加载资源】
    function loadResource(opt, callback) {
      switchManager.selectView("loadingPanel");     //显示进度条面板
      var loader = new ResourceLoader(opt);         //实例 资源加载器
      var $percent = $('#id_loadPercent').html(0);
      var $bar = $('#id_loadRate').css('width', 0);
      
      //加载资源监听'loading'事件
      //参数data：发射'loading'时，提供的参数{total: this.totalCount, loaded: this.loadedCount}
      loader.on('loading', function(data) {  
        var n = parseInt(data.loaded * 100 / data.total, 10);   //解析为十进制的整数，忽略小数
        $bar.css('width', n + '%');
        $percent.html(n);
      });
      
      //加载资源监听'complete'事件，执行参数callback函数 ：function() { gamePrelude();}
      loader.on('complete', function() {
        if (callback) {
          setTimeout(function(){
            callback();              //这个加载场景资源完成后才执行--02
          }, 500);
        }
      });

      //执行资源加载器的场景资源加载----------------------这个先执行---01
      loader.loadAreaResource();
    }

    //进入场景--------------------------------------------------------------------------------------【进入场景】
    //请求进入场景返回cb：{entities,curPlayer,map} 附近实体、玩家状态信息、地图基础信息（PS：entities是包括自己在内的实体）
    function enterScene(){
      pomelo.request("area.playerHandler.enterScene", null, function(data){
        app.init(data);   //初始化数据。实例场景new area，运行场景area.run，开启聊天系统chat.init
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

    //发射ai
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
        //如果是玩家，弹出选项，组队或者交易等
        if (entity.type === EntityType.PLAYER) {
          var curPlayer = app.getCurPlayer();
          pomelo.emit('onPlayerDialog', {targetId: targetId, targetPlayerId: entity.id,
            targetTeamId: entity.teamId, targetIsCaptain: entity.isCaptain,
            myTeamId: curPlayer.teamId, myIsCaptain: curPlayer.isCaptain});
        } else if (entity.type === EntityType.MOB) {
          //如果是怪物，请求服务器处理攻击事件
          pomelo.request('area.fightHandler.attack',{targetId: targetId}, function() {});
        }
      } else if (entity.type === EntityType.NPC) {
        //如果是NPC，通知服务器npc对话，不用回调
        pomelo.notify('area.playerHandler.npcTalk',{areaId :areaId, playerId: playerId, targetId: targetId});
      } else if (entity.type === EntityType.ITEM || entity.type === EntityType.EQUIPMENT) {
        //如果是道具或装备，通知服务器拾取，不用回调
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


