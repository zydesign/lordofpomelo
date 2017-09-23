var pomelo = require('pomelo');
var areaService = require('./app/services/areaService');
var instanceManager = require('./app/services/instanceManager');
var scene = require('./app/domain/area/scene');
var instancePool = require('./app/domain/area/instancePool');
var dataApi = require('./app/util/dataApi');
var routeUtil = require('./app/util/routeUtil');
var playerFilter = require('./app/servers/area/filter/playerFilter');
var ChatService = require('./app/services/chatService');
var sync = require('pomelo-sync-plugin');
// var masterhaPlugin = require('pomelo-masterha-plugin');

/**
 * Init app for client
 */
var app = pomelo.createApp();
app.set('name', 'lord of pomelo');

app.configure('production|development', function () {
    app.before(pomelo.filters.toobusy());  //接口访问限制。超时过滤处理
    app.enable('systemMonitor');

    app.filter(pomelo.filters.time()); //开启conn日志，对应pomelo-admin模块下conn request
    app.rpcFilter(pomelo.rpcFilters.rpcLog());//开启rpc日志，对应pomelo-admin模块下rpc request

    // var sceneInfo = require('./app/modules/sceneInfo');
    var onlineUser = require('./app/modules/onlineUser');
    if (typeof app.registerAdmin === 'function') {
        // app.registerAdmin(sceneInfo, {app: app});
        app.registerAdmin(onlineUser, {app: app});
    }
});

// configure for global  全局配置
app.configure('production|development', function () {
    require('./app/util/httpServer');  //启动httpServer服务

    //Set areasIdMap, a map from area id to serverId.
    if (app.serverType !== 'master') {
        var areas = app.get('servers').area;
        //将服务器areas的id存到areaIdMap里面，客户端指定一个值key为服务器数据的area属性（如：1），即得服务器id（如：area-server-1）
        var areaIdMap = {};
        for (var id in areas) {
            areaIdMap[areas[id].area] = areas[id].id;
        }
        app.set('areaIdMap', areaIdMap);
    }
    // proxy configures  代理配置
    app.set('proxyConfig', {
        cacheMsg: true,   //是否缓存
        interval: 30,
        lazyConnection: true,
        enableRpcLog: true
    });

    // remote configures 远程配置
    app.set('remoteConfig', {
        cacheMsg: true,  //是否缓存
        interval: 30
    });

    // route configures  路由配置，RPC时，会先执行路由配置，路由到对应的子服务器，再执行hander处理
    app.route('area', routeUtil.area);
    app.route('connector', routeUtil.connector);

    //mysql数据库连接配置，将被dao-pool对象池调用去连接数据库
    app.loadConfig('mysql', app.getBase() + '/../shared/config/mysql.json');
    app.filter(pomelo.filters.timeout());  //全局启用超时过滤，意思是所有后端服务器都启用超时服务

    /*高可用插件
     // master high availability
     app.use(masterhaPlugin, {
     zookeeper: {
     server: '127.0.0.1:2181',
     path: '/pomelo/master'
     }
     });
     */
});

// Configure for auth server  验证服务器配置
app.configure('production|development', 'auth', function () {
    // load session congfigures
    app.set('session', require('./config/session.json'));
});

// Configure for area server  场景服务器配置
app.configure('production|development', 'area', function () {
    
    //发送area服务器的msg采用做序列化请求
    app.filter(pomelo.filters.serial());
    
    //app.before（）只调用参数工厂函数里面的before； app.filter（）调用参数的filter、before、after；同理app.after（）只调用after
    //PS：过滤器执行顺序，globalBeforeFilter -> 前端服务器 -> beforeFilter -> 后端服务器 -> afterFilter -> globalAfterFilter，再然后把处理数据返回客户端
    app.before(playerFilter());  

    //Load scene server and instance server
    //这里当前服务器app.curServer即为area路由到的area子服务器
    var server = app.curServer;
    if (server.instance) {
        instancePool.init(require('./config/instance.json'));
        app.areaManager = instancePool;
    } else {
        //场景配置的读取入口。[执行场景初始化代入场景数据]   (/config/data/area.json--场景数据，包含了对应地图路径，是地图读取入口）
        scene.init(dataApi.area.findById(server.area));
        //然后将初始化过的场景加入app上下文
        app.areaManager = scene;
    }

    //Init areaService 执行场景服务初始化
    areaService.init();
});

//管理服务器配置，主要是增加，删除副本area服务器
app.configure('production|development', 'manager', function () {
    
    //监听增加，删除服务事件
    var events = pomelo.events;
    app.event.on(events.ADD_SERVERS, instanceManager.addServers);
    app.event.on(events.REMOVE_SERVERS, instanceManager.removeServers);
});


// Configure database 数据库连接配置
app.configure('production|development', 'area|auth|connector|master', function () {
    //用于执行mql语句的连接数据库模块
    var dbclient = require('./app/dao/mysql/mysql').init(app);
    app.set('dbclient', dbclient);
    // app.load(pomelo.sync, {path:__dirname + '/app/dao/mapping', dbclient: dbclient});
    app.use(sync, {sync: {path: __dirname + '/app/dao/mapping', dbclient: dbclient}});
});


//前端服务器配置
app.configure('production|development', 'connector', function () {
    var dictionary = app.components['__dictionary__'];
    var dict = null;
    if (!!dictionary) {
        dict = dictionary.getDict();
    }

    //前端配置
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            heartbeat: 30,
            useDict: true,
            useProtobuf: true,
            handshake: function (msg, cb) {
                cb(null, {});
            }
        });
});


//gate服务器配置
app.configure('production|development', 'gate', function () {
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            useProtobuf: true
        });
});


//聊天服务器配置
// Configure for chat server
app.configure('production|development', 'chat', function () {
    app.set('chatService', new ChatService(app));
});

//start
app.start();

// Uncaught exception handler
process.on('uncaughtException', function (err) {
    console.error(' Caught exception: ' + err.stack);
});
