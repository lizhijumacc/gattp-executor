(function(){
	
	var root = this;
	
	var GattExecutor = {};
	
	if (typeof exports !== 'undefined') {
		GattExecutor = exports;
	} else {
		GattExecutor = root.GattExecutor = {};
	}
	
	GattExecutor.socket;
	
	var exec = GattExecutor.exec = function(url){
		var re = new RegExp("((gatt)://)([a-zA-Z0-9_-]+\.)*?((/[a-zA-Z0-9\&%_\./-~-]*)|(?=[^a-zA-Z0-9\.]))");
		
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
							report({"code":200,devices:BC.bluetooth.devices});
						}else{
							report({"code":312,"error":"there is no device found!"});
						}	
					},last);
				}else if(method == "stopscan"){
					BC.Bluetooth.StopScan();
					BC.bluetooth.removeEventListener('newdevice');
					report({"code":200,"success":"stop scan success!"});					
				}else if(method == "startscan"){
					BC.Bluetooth.StartScan("le");
					BC.bluetooth.addEventListener('newdevice',function(s){
						var device = s.target;
						report({"code":200,"device":device});
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
				var method = requests["method"];
				var value = requests["value"];
				var device = new BC.Device({deviceAddress:deviceAddress,type:"BLE"});
				device.connect(function(){
					if(suuid){
						device.discoverServices(function(){
							var service = device.getServiceByUUID(suuid)[sindex];
							if(cuuid){
								service.discoverCharacteristics(function(){
									var chara = service.getCharacteristicByUUID(cuuid)[cindex];
									operateChar(chara,method,value);
								},function(){
									report({"code":303,"error":"discoverCharacteristics error!"});
								});							
							}
						},function(){
							report({"code":302,"error":"discoverServices error!"});
						});
					}
				},function(){
					report({"code":301,"error":"connect device error!"});
				});
			}
		}else{
			report({"code":300,"error":"RegEx match error!"});
			return;
		}
	};
	
	function operateChar(chara,method,value){
		if(method === "write"){
			if(chara.property.contains("write") || chara.property.contains("writeWithoutResponse")){
				if(value){
					chara.write(value,function(){
						report({"code":200,"success":"write success!"});
					},function(){
						report({"code":304,"error":"write error!"});
					});	
				}else{
					report({"code":305,"error":"no value to write"});
				}
			}else{
				report({"code":306,"error":"has no write property"});
			}
		}else if(method === "read"){
			if(chara.property.contains("read")){
				chara.read(function(data){
					report({"code":200,data:data});
				},function(){
					report({"code":307,"error":"read error!"});
				});				
			}else{
				report({"code":308,"error":"has no read property"});
			}
		}else if(method === "subscribe"){
			if(chara.property.contains("notify") || chara.property.contains("indicate")){
				chara.subscribe(function(data){
					report({"code":200,data:data});
				});
			}else{
				report({"code":309,"error":"has no notify or indicate property"});
			}
		}else if(method === "unsubscribe"){
			if(chara.property.contains("notify") || chara.property.contains("indicate")){
				chara.unsubscribe(function(){
					report({"code":200,"success":"unsubscribe success!"});
				},function(){
					report({"code":310,"error":"unsubscribe error!"});
				});
			}else{
				report({"code":309,"error":"has no notify or indicate property"});
			}
		}else{
			report({"code":311,"error":"method is not support"});
		}
	};
	
	function report(response){
		if(GattExecutor.socket){
			response.room = GattExecutor.room;
			GattExecutor.socket.emit("response",response);
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
	}
})();