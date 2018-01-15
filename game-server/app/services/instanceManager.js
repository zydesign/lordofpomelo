var pomelo = require('pomelo');
var utils = require('../util/utils');
var dataApi = require('../util/dataApi');
var consts = require('../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);
var INSTANCE_SERVER = 'area';

//副本管理
//The instance map, key is instanceId, value is serverId

var instances = {};      //副本服务器id组

//All the instance servers

var instanceServers = [];    //副本服务器数组

var exp = module.exports;

//app开启了events.ADD_SERVERS服务器事件监听，如果管理服务器manager.remote.instanceRemote.create添加服务器执行，这里的addServers也会被执行
//ps:参数是固定的，就是服务器列表
exp.addServers = function(servers){
  for(var i = 0; i < servers.length; i++){
    var server = servers[i];

    if(server.serverType === 'area' && server.instance){
      instanceServers.push(server);
    }
  }
};

//解析同上
exp.removeServers = function(servers){
  for(var i = 0; i < servers.length; i++){
    var server = servers[i];

    if(server.serverType === 'area' && server.instance){
      exp.removeServer(server.id);
    }
  }

  logger.info('remove servers : %j', servers);
};

//
exp.getInstance = function(args, cb){
  //The key of instance
  var instanceId = args.areaId + '_' + args.id;

  //If the instance exist, return the instance
  if(instances[instanceId]){
    utils.invokeCallback(cb, null, instances[instanceId]);
    return;
  }

  var app = pomelo.app;

  //Allocate a server id  获取当前的逻辑服务器id
  var serverId = getServerId();

  //rpc invoke
  var params = {
    namespace : 'user',
    service : 'areaRemote',
    method : 'create',
    args : [{
      areaId : args.areaId,
      instanceId : instanceId
    }]
  };

  //这里就是创建服务器了，等于发射‘events.ADD_SERVERS’事件---------------------------------------------11
  //相当于pomelo.app.rpc.area.remote.areaRemote.create（）
  app.rpcInvoke(serverId, params, function(err, result){
    if(!!err) {
      console.error('create instance error!');
      utils.invokeCallback(cb, err);
      return;
    }

    instances[instanceId] = {
      instanceId : instanceId,
      serverId : serverId
    };

    utils.invokeCallback(cb, null, instances[instanceId]);
  });

};
//删除副本。（管理服务器的instanceRemote.remove调用该函数）
exp.remove = function(instanceId){
  if(instances[instanceId]) delete instances[instanceId];
};

//Get the server to create the instance
var count = 0;
function getServerId(){
  if(count >= instanceServers.length) count = 0;

  var server = instanceServers[count];

  count++;
  return server.id;
}

function filter(req){
  var playerId = req.playerId;

  return true;
}

exp.removeServer = function(id){
  for(var i = 0; i < instanceServers.length; i++){
    if(instanceServers[i].id === id){
      delete instanceServers[i];
    }
  }
};
