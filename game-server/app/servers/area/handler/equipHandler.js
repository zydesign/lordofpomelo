/**
 * Module dependencies
 */

var handler = module.exports;
var dataApi = require('../../../util/dataApi');

/**
 * Equip equipment, handle client' request
 *
 * @param {Object} msg, message
 * @param {Session} session
 * @api public
 */
//客户端发起，穿装备。
handler.equip = function(msg, session, next) {
	var player = session.area.getPlayer(session.get('playerId'));
  var status = false;
//通过参数的背包index获取物品信息
  var item = player.bag.items[msg.index];
  var bagIndex = -1;
//如果通过背包标签能获取道具，则通过物品id读取装备数据
  if (item) {
    var eq =  dataApi.equipment.findById(item.id);
	  //如果获取不到装备数据或角色等级穿不起装备，返回失败状态
		if(!eq || player.level < eq.heroLevel){
			next(null, {status: false});
			return;
		}

    //玩家穿装备并获取脱下的装备在背包的位置Index
    bagIndex = player.equip(eq.kind, eq.id);
    //删除背包中被穿起的物品
    player.bag.removeItem(msg.index);

    status = true;
  }
	//返回消息：是否穿起状态、脱下装备的背包位置
  next(null, {status: status, bagIndex: bagIndex});
};

/**
 * Unequip equipment, handle client' request
 *
 * @param {Object} msg
 * @param {Session} session
 * @api public
 */
//客户端发起，脱下装备。
handler.unEquip = function(msg, session, next) {
	var player = session.area.getPlayer(session.get('playerId'));
  var status = false;
  var bagIndex = -1;
	//是否装备放回背包
  if (msg.putInBag) {
	  //获取装备放回背包的标签index
    bagIndex = player.bag.addItem({id: player.equipments.get(msg.type), type: 'equipment'});
	  //判断标签，是否背包满，如果不满执行玩家脱装备函数
    if (bagIndex > 0) {
      player.unEquip(msg.type);
      status = true;
    }
  } else {
	  //装备不用放回背包，只需执行脱装备函数
    player.unEquip(msg.type);
    status = true;
  }

  next(null, {status: status, bagIndex: bagIndex});
};

