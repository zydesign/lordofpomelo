var pomelo = require('pomelo');
var utils = require('../util/utils');
var dataApi = require('../util/dataApi');
var consts = require('../consts/consts');
var logger = require('pomelo-logger').getLogger(__filename);
var INSTANCE_SERVER = 'area';

//副本管理服务
//The instance map, key is instanceId, value is serverId

var instances = {};      //副本服务器id组

//All the instance servers

var instanceServers = [];    //副本服务器数组

var exp = module.exports;

//app开启了events.ADD_SERVERS服务器事件监听，如果管理服务器manager.remote.instanceRemote.create添加服务器执行，这里的addServers也会被执行
//ps:参数servers是固定的，就是servers.json
//添加所有副本类型场景服务器信息到数组
exp.addServers = function(servers){
  //遍历服务器表的所有服务器，将场景副本类的服务器数据加入instanceServers
  for(var i = 0; i < servers.length; i++){
    var server = servers[i];

    if(server.serverType === 'area' && server.instance){
      instanceServers.push(server);
    }
  }
};

//删除副本服务器数组的所有服务器信息
exp.removeServers = function(servers){
  for(var i = 0; i < servers.length; i++){
    var server = servers[i];

    if(server.serverType === 'area' && server.instance){
      exp.removeServer(server.id);
    }
  }

  logger.info('remove servers : %j', servers);
};

//获取或创建副本。返回{副本服务器id，副本id}（管理服务器的instanceRemote.create调用该函数）
exp.getInstance = function(args, cb){
  //The key of instance
  var instanceId = args.areaId + '_' + args.id;    //areaId_playerId 格式：1_1  (副本id)

  //If the instance exist, return the instance
  //如果能获取指定id的【副本服务器id】，cb为该【副本服务器id】---------------------------------------------
  if(instances[instanceId]){
    utils.invokeCallback(cb, null, instances[instanceId]);
    return;
  }

  var app = pomelo.app;

  //Allocate a server id 
  //获取一个空闲副本服务器的id。（这个getServerId()并不是app.getServerId()，是这里自定义的）。
  var serverId = getServerId();

  //rpc invoke
  var params = {
    namespace : 'user',
    service : 'areaRemote',
    method : 'create',
    args : [{
      areaId : args.areaId,     //目标场景id
      instanceId : instanceId   //副本id
    }]
  };

  //这里就是创建服务器了，等于发射‘events.ADD_SERVERS’事件---------------------------------------------11
  //由管理服务器发起的rpc，相当于app.rpc.area.remote.areaRemote.create（）
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
//通过副本服务器数据组，顺序获取空闲的【副本服务器id】
var count = 0;
function getServerId(){
  if(count >= instanceServers.length) count = 0;

  var server = instanceServers[count];

  count++;
  return server.id;
}

//过滤器
function filter(req){
  var playerId = req.playerId;

  return true;
}


//删除副本服务器组的指定id的服务器信息
exp.removeServer = function(id){
  for(var i = 0; i < instanceServers.length; i++){
    if(instanceServers[i].id === id){
      delete instanceServers[i];
    }
  }
};
