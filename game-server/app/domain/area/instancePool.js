var Instance = require('./instance');
var dataApi = require('../../util/dataApi');
var Map = require('../map/map');
var pomelo = require('pomelo');

var logger = require('pomelo-logger').getLogger(__filename);

//场景副本池，就是场景副本的管理类
var exp = module.exports;

var instances;
var intervel;
var maps = {};

//副本池初始化（app启动立即执行该函数）...........................1
exp.init = function(opts){
  instances = {};   //场景副本组
  intervel = opts.intervel||60000;   //时间间隔

  setInterval(check, intervel);   //启动定时器
};


//创建场景副本。获取场景数据，加入游戏地图，然后实例副本Instance，并加入副本组，如果创建成功返回true-------------------------增
//（场景服务器的areaRemote.create调用该函数 ）
exp.create = function(params){
  var id = params.instanceId;
  var areaId = params.areaId;

  //如果场景副本组中有了该副本，返回失败
  if(instances[id]) return false;

  //get area map
  //获取该场景副本数据
  var opts = dataApi.area.findById(areaId);
  //如果地图组没有该游戏地图，生成一个游戏地图实例
  if(!maps[areaId]){
    //从场景数据读取地图路径的tiledmap表单，生成游戏地图
    maps[areaId] = new Map(opts);
  }
  //场景副本数据中加入该游戏地图
  opts.map = maps[areaId];

  //Create instance
  //实例副本场景
  var instance = new Instance(opts);

  //将副本场景加入副本组中
  instances[id] = instance;

  //启动该副本
  instance.start();
  return true;
};

//删除场景副本，先关闭该副本，然后从副本组中删除，如果删除成功，返回true--------------------删
exp.remove = function(params){
  var id = params.id;
  if(!instances[id]) return false;

  var instance = instances[id];
  instance.close();
  delete instances[id];

  return true;
};

//获取场景副本-----------------------------------------查
exp.getArea = function(instanceId){
  return instances[instanceId].area;
};


//（app启动就立即【定时执行】）...........................................每6秒检查一次.............2
function check(){
  var app = pomelo.app;
  for(var id in instances){
    var instance = instances[id];

    //重启场景副本，如果该场景没有活动玩家（玩家退出副本），关闭该场景副本，并从副本组中删除
    if(!instance.isAlive()){
      app.rpc.manager.instanceRemote.remove(null, id, onClose);
    }
  }
}

function onClose(err, id){
  if(!err){
    instances[id].close();
    delete instances[id];
    logger.info('remove instance : %j', id);
  }else{
    logger.warn('remove instance error! id : %j, err : %j', id, err);
  }
}

