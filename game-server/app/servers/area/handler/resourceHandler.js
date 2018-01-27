/**
 * Module dependencies
 */

var app = require('pomelo').app;
var dataApi = require('../../../util/dataApi');
var EntityType = require('../../../consts/consts').EntityType;
var fs = require("fs");

var handler = module.exports;

/**
 * Get file'version
 *
 * @param {String} path, file path
 * @return {Number}
 * @api private
 */
//获取文件版本号,返回修改时间（数值）
var _getFileVersion = function(path) {
  //mtime属性得到文件的"修改时间"日期字符串。
  return (new Date(fs.statSync(path).mtime)).getTime();
};

//所有类型数据表的版本（最新修改时间）
var version = {
  fightskill: _getFileVersion('./config/data/fightskill.json'),   //战斗技能版本
  equipment:  _getFileVersion('./config/data/equipment.json'),    //装备版本
  item: _getFileVersion('./config/data/item.json'),               //道具版本
  character: _getFileVersion('./config/data/character.json'),     //怪物角色版本
  npc: _getFileVersion('./config/data/npc.json'),                 //npc版本
  animation:  _getFileVersion('./config/animation_json'),         //动画版本
  effect: _getFileVersion('./config/effect.json')                 //特效版本
};

var animationFiles = [];           //动画文件组

/**
 * Get animation data with the given path.
 *
 * @retun {Object}
 * @api public
 */

//获取或创建 动画json对象
var _getAnimationJson = function() {
  var path = '../../../../config/animation_json/';
  var data = {};
  //如果动画组没有数据，读取动画文件，生成动画组，并生成data对象
  if (animationFiles.length === 0) {
    var dir = './config/animation_json';
    var name, reg = /\.json$/;
    fs.readdirSync(dir).forEach(function(file) {    //每一个动画文件为一份数据
      if (reg.test(file)) {
        name = file.replace(reg, '');            //文件名作为单份数据的key
        animationFiles.push(name);
        data[name] = require(path + file);
      }
    });
  } else {
    //如果动画组有数据，通过动画组生成data对象
    animationFiles.forEach(function(name) {
      data[name] = require(path + name + '.json');
    });
  }

  return data;
};

/**
 * Load response of fightskill, equipment, item, animation, effect according to it's version
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，加载资源（客户端的resourceLoader.loadJsonResource发起请求）
//返回cb给客户端：{data: data,version: version} 各类型的总数据 和 各类型的最新版本
handler.loadResource = function(msg, session, next) {
  var data = {};
  //如果参数的version与当前的最新数据表版本不一致，获取对应类型数据表的全部数据（动画数据和特效数据单独获取）
  if (msg.version.fightskill !== version.fightskill) {
    data.fightskill = dataApi.fightskill.all();
  }
  if (msg.version.equipment !== version.equipment) {
    data.equipment = dataApi.equipment.all();
  }
  if (msg.version.item !== version.item) {
    data.item = dataApi.item.all();
  }
  if (msg.version.character !== version.character) {
    data.character = dataApi.character.all();
  }
  if (msg.version.npc !== version.npc) {
    data.npc = dataApi.npc.all();
  }
  if (msg.version.animation !== version.animation) {
    data.animation = _getAnimationJson();                       //获取动画数据
  }
  if (msg.version.effect !== version.effect) {
    data.effect = require('../../../../config/effect.json');    //获取特效数据
  }

  next(null, {
    data: data,
    version: version
  });
};

/**
 * Load area response of entities, wich contains mobs, players, npcs, items and equipments.
 *
 * @param {Object} msg
 * @param {Object} session
 * @param {Function} next
 * @api public
 */
//客户端发起，地图资源加载
handler.loadAreaResource = function(msg, session, next) {
  var entities = session.area.getAllEntities();
  var players = {}, mobs = {}, npcs = {}, items = {}, equips = {};
  var i, e;
  for (i in entities) {
    e = entities[i];
    if (e.type === EntityType.PLAYER) {
      if (!players[e.kindId]) {                //kindId是基类Entity的属性，读到数据表的id，不是数据库id
        players[e.kindId] = 1;
      }
    } else if(e.type === EntityType.MOB) {
      if (!mobs[e.kindId]) {
        mobs[e.kindId] = 1;
      }
    } else if(e.type === EntityType.NPC) {
      if (!npcs[e.kindId]) {
        npcs[e.kindId] = 1;
      }
    }else if (e.type === EntityType.ITEM) {
      if (!items[e.kindId]) {
        items[e.kindId] = 1;
      }
    }else if (e.type === EntityType.EQUIPMENT) {
      if (!equips[e.kindId]) {
        equips[e.kindId] = 1;
      }
    }
  }

  next(null, {
    players: Object.keys(players),          //所有player数据表id
    mobs: Object.keys(mobs),                //所有mob数据表Id
    npcs: Object.keys(npcs),                //所有npc数据表Id
    items: Object.keys(items),              //所有item数据表Id
    equipments: Object.keys(equips),        //所有equip数据表Id
    mapName: session.area.map.name          //地图名称
  });

};

