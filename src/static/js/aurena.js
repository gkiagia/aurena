aurena = {

websocket_listener : function()
{
  if (aurena.ws != null)
    return;

  if (!("WebSocket" in window) && ("MozWebSocket" in window))
    window.WebSocket = window.MozWebSocket;

  if ("WebSocket" in window)
  {
     var url = document.URL.replace("http", "ws") + "../client/control_events";
     var ws = new WebSocket(url, "aurena");
     aurena.ws = ws;

     ws.onopen = function()
     {
        $("#connstatus").html("<p>Connected</p>");
     };
     ws.onmessage = function (evt)
     {
        var received_msg = evt.data;

        if (typeof received_msg == typeof("")) {
            aurena.handle_event(received_msg);
        }
     };
     ws.onclose = function()
     {
        $("#connstatus").html("<p>Disconnected</p>");
        aurena.ws = null;
        setTimeout(aurena.websocket_listener, 1000);
     };
  }
  else
  {
     $("#debug").prepend("<p>websocket connections not available!</p>");
  }
},
update_playstate : function() {
  if (aurena.paused) {
    $("#playstate").html("Paused");
  }
  else {
    $("#playstate").html("Playing");
  }
  if (aurena.cur_media != 0)
    $("#nowplaying").html("track " + aurena.cur_media);
  else
    $("#nowplaying").html("None");
},

set_vol_slider : function set_vol_slider(client_id, vol, anim) {
  var s;

  if (client_id == 0)
    s = $("#mastervolslider");
  else
    s = $("#volume-" + client_id);

  if (!aurena.sliding && vol != s.slider("value")) {
    // $("#debug").prepend("<p>Setting vol " + vol + "</p>");
    aurena.slide_update = true;
    s.slider("option", "animate", anim);
    s.slider("value", vol);
    s.slider("option", "animate", true);
    aurena.slide_update = false;
  }
},

handle_event : function handle_event(data) {
  json = $.parseJSON(data);
  switch (json["msg-type"]) {
    case "enrol":
      var vol = json["volume-level"];
      aurena.paused = json["paused"];
      aurena.cur_media = json["resource-id"];

      aurena.set_vol_slider (0, vol, false);
      aurena.update_playstate();
      break;
    case "volume":
      var vol = json["level"];
      aurena.set_vol_slider (0, vol, true);
      break;
    case "pause":
      aurena.paused = true;
      aurena.update_playstate();
      break;
    case "play":
      aurena.paused = false;
      aurena.update_playstate();
      break;
    case "set-media":
      aurena.paused = json["paused"];
      aurena.cur_media = json["resource-id"];
      aurena.update_playstate();
      break;
    case "player-clients-changed":
      aurena.update_player_clients();
      break;
    default:
      $("#debug").prepend("<p>Received message of type " + json["msg-type"] + ": " + data + "</p>");
      break;
  }
},
update_player_clients : function () {
  $.getJSON("../client/player_info", function(data) {
     var items = [];
     var clients = data['player-clients'];
     aurena.clients = clients;
     $.each(clients, function(key, val) {
       var enable_id = "enable-" + val["client-id"];
       var volume_id = "volume-" + val["client-id"];
       var info = '<li id="' + val["client-id"] + '">';
       info += "<input type='checkbox' id='" + enable_id + "'/>";
       info += " Client " + val["host"];
       info += " <div id='" + volume_id + "' />";
       info += '</li>';
       items.push(info);
        console.log ("Client data " + JSON.stringify(val));
     });
     $("#cliententries").empty().prepend($('<ul/>', {
       html: items.join('')
     }));
     $.each(clients, function(key, val) {
       var enable_id = "enable-" + val["client-id"];
       var volume_id = "volume-" + val["client-id"];

       $("#" + volume_id).slider({
         animate: true,
         min : 0.0, max : 1.5, range : 'true', value : 1.0, step : 0.01,
         start : function(event, ui) { //$("#debug").prepend("<p>start");
                                       aurena.sliding = true; },
         stop : function(event, ui) { setTimeout(function() { aurena.sliding = false; }, 100); },
         slide : function(event, ui) { aurena.volChange = true; aurena.send_slider_volume(val["client-id"]); },
         change : function(event, ui) { aurena.volChange = true; aurena.send_slider_volume(val["client-id"]); }
       });
       $("#" + enable_id).attr('checked', val["enabled"]);
       console.log ($("#" + enable_id));
     });
  });
},

send_slider_volume : function send_slider_volume(client_id) {
  var curVol = $("#mastervolslider").slider( "option", "value");
  $('#mastervolval').text(Math.round(curVol * 100).toString() + '%');

  if (aurena.sendingVol || !aurena.volChange || aurena.slide_update) return;
  aurena.sendingVol = true; aurena.volChange = false;
  // $("#debug").prepend("<p>Sending volume " + curVol.toString() + "</p>");
  $.ajax({
    type: 'POST',
    url: "../control/volume",
    data: { level: curVol.toString() }
  }).complete(function() {
        aurena.sendingVol = false; aurena.send_slider_volume(0);
  });
},

init : function() {
  aurena.sendingVol = false;
  aurena.volChange = false;

  aurena.sliding = false;
  aurena.slide_update = false;
  aurena.paused = true;
  aurena.cur_media = 0;

  $("#mastervolslider").slider({
     animate: true,
     min : 0.0, max : 1.5, range : 'true', value : 1.0, step : 0.01,
     start : function(event, ui) { //$("#debug").prepend("<p>start");
                                   aurena.sliding = true; },
     stop : function(event, ui) { setTimeout(function() { aurena.sliding = false; }, 100); },
     slide : function(event, ui) { aurena.volChange = true; aurena.send_slider_volume(0); },
     change : function(event, ui) { aurena.volChange = true; aurena.send_slider_volume(0); }
  });
  $("#play").click(function() { $.ajax({ url: "../control/play", type: 'POST' }); });
  $("#pause").click(function() { $.ajax({ url: "../control/pause" , type: 'POST'}); });
  $("#next").click(function() { $.ajax({ url: "../control/next" , type: 'POST'}); });
  aurena.websocket_listener();
}

};

$(document).ready(function() {
  aurena.init();
});
