var exp = module.exports;

//路由是为了rpc指向指定的服务器处理逻辑

//路由到session绑定的后端id
exp.area = function(session, msg, app, cb) {
	var serverId = session.get('serverId');   //从session获取目标服务器id

	if(!serverId) {
		cb(new Error('can not find server info for type: ' + msg.serverType));
		return;
	}

	cb(null, serverId);
};

//路由到前端id
exp.connector = function(session, msg, app, cb) {
	if(!session) {
		cb(new Error('fail to route to connector server for session is empty'));
		return;
	}

	if(!session.frontendId) {
		cb(new Error('fail to find frontend id in session'));
		return;
	}

	cb(null, session.frontendId);
};
