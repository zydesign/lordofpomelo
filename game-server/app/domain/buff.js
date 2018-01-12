
//状态技能的基类buff
function Buff(opts){
	this.type = opts.type;                       //类型
	this.timeout = opts.timeout;                 //buff的有效时间
	this.useCallback = opts.useCallback;         //使用技能函数
	this.unuseCallback = opts.unuseCallback;     //取消使用技能函数
}

//buff技能的use方法（作用都是修改player的属性。会同步到数据库和客户端）（）-----------------------------------------------0
//客户端主动使用技能会将player属性返回给客户端
Buff.prototype.use = function(player) {
	//如果useCallback存在
	if (!!this.useCallback) {
		player.addBuff(this);       //Character.addBuff函数，将buff实例加入buff数组
		this.useCallback(player);   //执行使用技能函数，给player添加一个buff属性值
		
		//如果设置了有效时间，并且取消技能函数可用
		if (this.timeout > 0){
			//取消技能函数可用
			if (!!this.unuseCallback) {
				//定时执行角色的buff数组删除buff，更改对应的buff属性
				setTimeout(function(){
					player.removeBuff(this);  //角色实体执行.removeBuff函数，将buff实例加从buff数组删除
					this.unuseCallback(player);
				}, this.timeout);
			}
		}
	}
};

//实例 混乱buff技能
var ConfuseBuff = (function() {
	return function(timeout) {
		return new Buff({
			type: 'confuse',
			//使用技能函数
			useCallback: function(player){
				player.confused = true;
			},
			//取消使用技能函数
			unuseCallback: function(player){
				player.confused = false;
			}
		});
  };
})();


//实例 攻击增强（强攻）
var AttackStrengthenBuff = (function() {
	return function(increaseParam, timeout) {
		return new Buff({
			type: 'attackStrengthen',
			useCallback: function(player){
				player.attackParam *= increaseParam;
			},
			unuseCallback: function(player){
				player.attackParam /= increaseParam;
			}
		});
  };
})();

//防御增强
var DefenceStrengthenBuff = (function() {
	return function(increaseParam, timeout) {
		return new Buff({
			type: 'defenceStrengthen',
			useCallback: function(player){
				player.defeneceParam *= increaseParam;
			},
			unuseCallback: function(player){
				player.defence /= increaseParam;
			}
		});
  };
})();

//装备加强
var EquipmentStrengthenBuff = (function() {
	return function(increaseParam, timeout) {
		return new Buff({
			type: 'equipmentStrengthen',
			useCallback: function(player){
				player.equipmentParam *= increaseParam;
			},
			unuseCallback: function(player){
				player.equipmentParam /= increaseParam;
			}
		});
  };
})();

// 背水一战，加攻减防
// increase attack, decrease defence
var BeishuiyizhanBuff = (function() {
	return function(increaseParam, decreaseParam, timeout) {
		return new Buff({
			type: 'beishuiyizhan',
			useCallback: function(player){
				player.attackParam *= increaseParam;
				player.defenceParam /= decreaseParam;
			},
			unuseCallback: function(player){
				player.attackParam /= increaseParam;
				player.defenceParam *= decreaseParam;
			}
		});
  };
})();

//苦肉计，牺牲血量，加强攻击
var KuroujiBuff = (function() {
	return function(increaseParam, hp, timeout) {
		var used = false;
		return new Buff({
			type: 'kurouji',
			useCallback: function(player){
				if (player.hp < hp) {
					return;
				}
				used = true;
				player.hp -= hp;
				player.attackParam *= increaseParam;
				player.updateTeamMemberInfo();  //执行角色实体更新队伍信息，前提是玩家加入了队伍
			},
			unuseCallback: function(player){
				if (used) {
					player.attackParam /= increaseParam;
				}
			}
		});
  };
})();

var create = function(skill) {
	return null;
	//return new Buff(skill)   //我加的
};

module.exports.ConfuseBuff = ConfuseBuff;                                 //实例 混乱buff   （都没有给buff参数添加timeout很奇怪？）
module.exports.AttackStrengthenBuff = AttackStrengthenBuff;               //实例 加攻buff
module.exports.DefenceStrengthenBuff = DefenceStrengthenBuff;             //实例 加防buff
module.exports.EqipmentStrengthenBuff = EquipmentStrengthenBuff;          //实例 装备提升buff
module.exports.BeishuiyizhanBuff = BeishuiyizhanBuff;                     //实例 加攻减防buff
module.exports.KuroujiBuff = KuroujiBuff;                                 //实例 加攻减血buff

module.exports.create = create;                                           //实例 自定义参数buff                            

