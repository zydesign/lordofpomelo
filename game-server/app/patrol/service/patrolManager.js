var Single = require('../mode/single');
var Loop = require('../mode/loop');
var Composite = require('../mode/composite');
var Wait = require('../mode/wait');

var STAND_TICK = 50;  //停留时间

//巡逻管理器
var Manager = function() {
  this.characters = {};   //角色组，一般为怪物
};

var pro = Manager.prototype;

/**
 * Add characters into patrol module and create patrol actions for them.
 *
 * @param cs {Array} array of character info.
 *        c.character {Character} character instance that with id and x, y stand for position of the character
 *        c.path {Array} array of position {x: x, y: y}
 */
//创建一个角色巡逻动作。(怪物ai大脑tiger执行巡逻子节点的doAction时，执行Timer.patrol，然后调用该函数)
//参数cs不是角色实体数组，cs[i]=={character: area.entities[entityId], path: area.entities[entityId].path}
pro.addCharacters = function(cs) {
  var c;
  for(var i=0, l=cs.length; i<l; i++) {
    c = cs[i];
	  //生成巡逻动作，并加入巡逻动作组
    if(!this.characters[c.character.entityId]) {
      this.characters[c.character.entityId] = genAction(c.character, c.path);
    }
  }
};

/**
 * Remove character from patrol module by id
 */

//删除一个怪物巡逻动作。（怪物受攻击要切换巡逻为ai攻击时，timer.enterAI(entityId)会调用该函数）
pro.removeCharacter = function(id) {
  delete this.characters[id];
};

//（timer.tick会定时执行这个update函数）
pro.update = function() {
	for(var id in this.characters) {
		this.characters[id].update();
	}
}; 

/**
 * Generate patrol actions for character.
 */
//生成巡逻动作，返回循环移动动作实例
var genAction = function(character, path) {
  var start = path[0];
  var res = new Loop({
    character: character,   //角色实体
    path: path,             //巡逻路径
    rounds: -1,             //循环圈数
    standTick: STAND_TICK   //停留时间
  });

  return res;
};

module.exports = Manager;
