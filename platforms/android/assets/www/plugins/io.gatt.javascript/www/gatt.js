cordova.define("io.gatt.javascript.gatt", function(require, exports, module) { 
	
	var root = this;
	
	var GattIO = {};
	
	if (typeof exports !== 'undefined') {
		GattIO = exports;
	} else {
		GattIO = root.GattIO = {};
	}
	
	var read = GattIO.read = function(url,callback){
		var options = {};
		options.callback = callback;
		url = url + "&method=read";
		GattIO.exec(url,options);
	};
	var write = GattIO.write = function(url,callback){
		var options = {};
		options.callback = callback;
		url = url + "&method=write";
		alert(url);
		GattIO.exec(url,options);
	};
	var subscribe = GattIO.subscribe = function(url,callback){
		var options = {};
		options.callback = callback;
		url = url + "&method=subscribe";
		GattIO.exec(url,options);
	};
	var unsubscribe = GattIO.unsubscribe = function(url,callback){
		var options = {};
		options.callback = callback;
		url = url + "&method=unsubscribe";
		GattIO.exec(url,options);
	};
	
	var exec = GattIO.exec = function(url,options){
		var re = new RegExp("((gatt)://)([a-zA-Z0-9_-]+\.)*?((/[a-zA-Z0-9\&%_\./-~-]*)|(?=[^a-zA-Z0-9\.]))");
		
		if(!options.success){
			options.success = function(data){
				console.log("success:" + JSON.stringify(data));
			};
		}
		if(!options.error){
			options.error = function(data){
				console.log("error:" + JSON.stringify(data));
			};
		}
		if(!options.callback){
			options.callback = function(){};
		}
		
		if(re.test(url)){
			var deviceAddress = "";
			var slashIndex = url.indexOf("//");
			var quesIndex = url.indexOf("?");
			if(quesIndex <= 0){
				deviceAddress = url.substr(slashIndex+2);
			}else{
				deviceAddress = url.substr(slashIndex+2,quesIndex-slashIndex-2);
			}
			var requests = getRequest(url.substr(quesIndex));
			if(deviceAddress === "localhost"){
				var method = requests["method"];
				var last = requests["last"];
				if(last >= 10000){
					last = 10000;
				}
				if(method == "getdevices"){
					BC.Bluetooth.StartScan("le");
					setTimeout(function(){
						BC.Bluetooth.StopScan();
						if(BC.bluetooth.devices !== {}){
							callback({"code":203,devices:BC.bluetooth.devices},options);
							BC.bluetooth.devices = {};
						}else{
							callback({"code":312,"error":"there is no device found!"},options);
						}	
					},last);
				}else if(method == "stopscan"){
					BC.Bluetooth.StopScan();
					BC.bluetooth.removeEventListener('newdevice');
					BC.bluetooth.devices = {};
					callback({"code":200,"success":"stop scan success!"},options);					
				}else if(method == "startscan"){
					BC.Bluetooth.StartScan("le");
					BC.bluetooth.addEventListener('newdevice',function(s){
						var device = s.target;
						callback({"code":200,"device":device},options);
					});
				}
			}else{
				var suuid = requests["suuid"];
				var sindex = 0;
				if(requests["sindex"]){
					sindex = requests["sindex"];
				}
				var cuuid = requests["cuuid"];
				var cindex = 0;
				if(requests["cindex"]){
					cindex = requests["cindex"];
				}
				var value = requests["value"];
				var device = new BC.Device({deviceAddress:deviceAddress,type:"BLE"});
				device.connect(function(){
					device.discoverServices(function(){
						if(method == "discoverServices"){
							callback({"code":200,"services":device.services},options);
							return;
						}
						if(suuid){
							var service = device.getServiceByUUID(suuid)[sindex];	
							service.discoverCharacteristics(function(){
								if(method == "discoverCharacteristics"){
									callback({"code":200,"characteristics":service.characteristics},options);
									return;								
								}
								if(cuuid){
									var chara = service.getCharacteristicByUUID(cuuid)[cindex];
									operateChar(chara,method,value,options);
								}else{
									callback({"code":314,"error":"cuuid is required!"},options);
								}
							},function(){
								callback({"code":303,"error":"discoverCharacteristics error!"},options);
							});	
						}else{
							callback({"code":313,"error":"suuid is required!"},options);
						}							
					},function(){
						callback({"code":302,"error":"discoverServices error!"},options);
					});
					
				},function(){
					callback({"code":301,"error":"connect device error!"},options);
				});
			}
		}else{
			callback({"code":300,"error":"RegEx match error!"},options);
			return;
		}
	};
	
	function operateChar(chara,method,value,options){
		if(method === "write"){
			if(chara.property.contains("write") || chara.property.contains("writeWithoutResponse")){
				if(value){
					chara.write("base64",value,function(){
						callback({"code":200,"success":"write success!"},options);
					},function(){
						callback({"code":304,"error":"write error!"},options);
					});	
				}else{
					callback({"code":305,"error":"no value to write"},options);
				}
			}else{
				callback({"code":306,"error":"has no write property"},options);
			}
		}else if(method === "read"){
			if(chara.property.contains("read")){
				chara.read(function(data){
					callback({"code":200,data:data},options);
				},function(){
					callback({"code":307,"error":"read error!"},options);
				});				
			}else{
				callback({"code":308,"error":"has no read property"},options);
			}
		}else if(method === "subscribe"){
			if(chara.property.contains("notify") || chara.property.contains("indicate")){
				chara.subscribe(function(data){
					callback({"code":200,data:data},options);
				});
			}else{
				callback({"code":309,"error":"has no notify or indicate property"},options);
			}
		}else if(method === "unsubscribe"){
			if(chara.property.contains("notify") || chara.property.contains("indicate")){
				chara.unsubscribe(function(){
					callback({"code":200,"success":"unsubscribe success!"},options);
				},function(){
					callback({"code":310,"error":"unsubscribe error!"},options);
				});
			}else{
				callback({"code":309,"error":"has no notify or indicate property"},options);
			}
		}else{
			callback({"code":311,"error":"method is not support"},options);
		}
	};
	
	function getRequest(params) {
	   var theRequest = {};
	   if (params.indexOf("?") != -1) {
		  var str = params.substr(1);
		  strs = str.split("&");
		  for(var i = 0; i < strs.length; i ++) {
			 theRequest[strs[i].split("=")[0]]=unescape(strs[i].split("=")[1]);
		  }
	   }
	   return theRequest;
	};
	
	function callback(data,options){
		options.callback(data);
		if(data.code < 299 && data.code > 199){
			options.success(data);
		}else{
			options.error(data);
		}
	};
	
	module.exports = GattIO;
});
