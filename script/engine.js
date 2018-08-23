(function() {
	var Engine = window.Engine = {

		VERSION: 1.3,
		MAX_STORE: 99999999999999,
		SAVE_DISPLAY: 30 * 1000,
		GAME_OVER: false,

		//object event types
		topics: {},

		Perks: {
			'boxer': {
				name: _('boxer'),
				desc: _('punches do more damage'),
				/// TRANSLATORS : means with more force.
				notify: _('learned to throw punches with purpose')
			},
			'martial artist': {
				name: _('martial artist'),
				desc: _('punches do even more damage.'),
				notify: _('learned to fight quite effectively without weapons')
			},
			'unarmed master': {
				/// TRANSLATORS : master of unarmed combat
				name: _('unarmed master'),
				desc: _('punch twice as fast, and with even more force'),
				notify: _('learned to strike faster without weapons')
			},
			'barbarian': {
				name: _('barbarian'),
				desc: _('melee weapons deal more damage'),
				notify: _('learned to swing weapons with force')
			},
			'slow metabolism': {
				name: _('slow metabolism'),
				desc: _('go twice as far without eating'),
				notify: _('learned how to ignore the hunger')
			},
			'desert rat': {
				name: _('desert rat'),
				desc: _('go twice as far without drinking'),
				notify: _('learned to love the dry air')
			},
			'evasive': {
				name: _('evasive'),
				desc: _('dodge attacks more effectively'),
				notify: _("learned to be where they're not")
			},
			'precise': {
				name: _('precise'),
				desc: _('land blows more often'),
				notify: _('learned to predict their movement')
			},
			'scout': {
				name: _('scout'),
				desc: _('see farther'),
				notify: _('learned to look ahead')
			},
			'stealthy': {
				name: _('stealthy'),
				desc: _('better avoid conflict in the wild'),
				notify: _('learned how not to be seen')
			},
			'gastronome': {
				name: _('gastronome'),
				desc: _('restore more health when eating'),
				notify: _('learned to make the most of food')
			}
		},

		options: {
			state: null,
			debug: false,
			log: false,
			dropbox: false,
			doubleTime: true
		},

		startMusic: function() {
			const fs = require('fs');

			var audio = [];

			var musicDir = __dirname + ((process.mainModule.filename.indexOf('app.asar') !== -1) ? '.unpacked' : '') + '/music/';
			fs.readdir(musicDir, (err, files) => {
				audio.playlist = files.filter(file => file.endsWith('.mp3')).map(file => musicDir + file);
			});

			function playAudio(playlistId){

				// Default playlistId to 0 if not supplied 
				playlistId = playlistId ? playlistId : 0;
				
				// If SoundManager object exists, get rid of it...
				if (audio.nowPlaying){
					audio.nowPlaying.destruct();
					// ...and reset array key if end reached
					if(playlistId == audio.playlist.length){
						playlistId = 0;
					}
				}
				// Standard Sound Manager play sound function...
				soundManager.onready(function() {
					audio.nowPlaying = soundManager.createSound({
						id: 'sk4Audio',
						url: audio.playlist[playlistId],
						autoLoad: true,
						autoPlay: true,
						volume: 50,
						// ...with a recursive callback when play completes
						onfinish: function(){
							playlistId ++;
							playAudio(playlistId);
						}
					})
				});
			}
			
			// Start
			playAudio(0);
		},

		init: function(options) {
			Engine.startMusic();

			this.options = $.extend(
				this.options,
				options
			);
			this._debug = this.options.debug;
			this._log = this.options.log;

			Engine.disableSelection();

			if(this.options.state != null) {
				window.State = this.options.state;
			} else {
				Engine.loadGame();
			}

			$('<div>').attr('id', 'locationSlider').appendTo('#main');

			var menu = $('<div>')
				.addClass('menu')
				.appendTo('body');

			if(typeof langs != 'undefined'){
				var customSelect = $('<span>')
					.addClass('customSelect')
					.addClass('menuBtn')
					.appendTo(menu);
				var selectOptions = $('<span>')
					.addClass('customSelectOptions')
					.appendTo(customSelect);
				var optionsList = $('<ul>')
					.appendTo(selectOptions);
				$('<li>')
					.text("language.")
					.appendTo(optionsList);

				$.each(langs, function(name,display){
					$('<li>')
						.text(display)
						.attr('data-language', name)
						.on("click", function() { Engine.switchLanguage(this); })
						.appendTo(optionsList);
				});
			}

			if (process.platform === "linux") {
				$('<span>')
					.addClass('menuBtn')
					.text(_('donate.'))
					.click(function() {
						const shell = require('electron').shell;
						shell.openExternal('https://www.paypal.me/chermenin');
					})
					.appendTo(menu);
			}

			$('<span>')
				.addClass('menuBtn')
				.text(_('exit.'))
				.click(Engine.confirmExit)
				.appendTo(menu);

			$('<span>')
				.addClass('menuBtn')
				.text(_('load.'))
				.click(Engine.loadFromFile)
				.appendTo(menu);

			$('<span>')
				.addClass('menuBtn')
				.text(_('save.'))
				.click(Engine.saveToFile)
				.appendTo(menu);

			$('<span>')
				.addClass('menuBtn')
				.text(_('restart.'))
				.click(Engine.confirmDelete)
				.appendTo(menu);

			// Register keypress handlers
			$('body').off('keydown').keydown(Engine.keyDown);
			$('body').off('keyup').keyup(Engine.keyUp);

			// Register swipe handlers
			swipeElement = $('#outerSlider');
			swipeElement.on('swipeleft', Engine.swipeLeft);
			swipeElement.on('swiperight', Engine.swipeRight);
			swipeElement.on('swipeup', Engine.swipeUp);
			swipeElement.on('swipedown', Engine.swipeDown);

			// subscribe to stateUpdates
			$.Dispatch('stateUpdate').subscribe(Engine.handleStateUpdates);

			$SM.init();
			Notifications.init();
			Events.init();
			Room.init();

			if(typeof $SM.get('stores.wood') != 'undefined') {
				Outside.init();
			}
			if($SM.get('stores.compass', true) > 0) {
				Path.init();
			}
			if($SM.get('features.location.spaceShip')) {
				Ship.init();
			}

			if($SM.get('config.lightsOff', true)){
					Engine.turnLightsOff();
			}

			if($SM.get('config.hyperMode', true)){
					Engine.triggerHyperMode();
			}

			Engine.saveLanguage();
			Engine.travelTo(Room);

		},

		saveGame: function() {
			if(typeof Storage != 'undefined' && localStorage) {
				if(Engine._saveTimer != null) {
					clearTimeout(Engine._saveTimer);
				}
				if(typeof Engine._lastNotify == 'undefined' || Date.now() - Engine._lastNotify > Engine.SAVE_DISPLAY){
					$('#saveNotify').css('opacity', 1).animate({opacity: 0}, 1000, 'linear');
					Engine._lastNotify = Date.now();
				}
				localStorage.gameState = JSON.stringify(State);
			}
		},

		saveToFile: function() {
			const {dialog} = require('electron').remote;
			const fs = require('fs');
			dialog.showSaveDialog({}, function(path) {
				if (path === undefined) {
					return;
				}
				fs.writeFile(path, Engine.export64(), function(err) {
					if (err == undefined) {
						$('#saveNotify').css('opacity', 1).animate({opacity: 0}, 1000, 'linear');
					}
				});
			});
		},

		loadFromFile: function() {
			const {dialog} = require('electron').remote;
			const fs = require('fs');
			dialog.showOpenDialog({}, function(paths) {
				if (paths === undefined) {
					return;
				}
				var value = fs.readFileSync(paths[0], 'utf-8');
				Engine.import64(value);
			});
		},

		loadGame: function() {
			try {
				var savedState = JSON.parse(localStorage.gameState);
				if(savedState) {
					State = savedState;
					$SM.updateOldState();
					Engine.log("loaded save!");
				}
			} catch(e) {
				State = {};
				$SM.set('version', Engine.VERSION);
				Engine.event('progress', 'new game');
			}
		},

		exportImport: function() {
			Events.startEvent({
				title: _('Export / Import'),
				scenes: {
					start: {
						text: [
							_('export or import save data, for backing up'),
							_('or migrating computers')
						],
						buttons: {
							'export': {
								text: _('export'),
								nextScene: {1: 'inputExport'}
							},
							'import': {
								text: _('import'),
								nextScene: {1: 'confirm'}
							},
							'cancel': {
								text: _('cancel'),
								nextScene: 'end'
							}
						}
					},
					'inputExport': {
						text: [_('save this.')],
						textarea: Engine.export64(),
						onLoad: function() { Engine.event('progress', 'export'); },
						readonly: true,
						buttons: {
							'done': {
								text: _('got it'),
								nextScene: 'end',
								onChoose: Engine.disableSelection
							}
						}
					},
					'confirm': {
						text: [
							_('are you sure?'),
							_('if the code is invalid, all data will be lost.'),
							_('this is irreversible.')
						],
						buttons: {
							'yes': {
								text: _('yes'),
								nextScene: {1: 'inputImport'},
								onChoose: Engine.enableSelection
							},
							'no': {
								text: _('no'),
								nextScene: {1: 'start'}
							}
						}
					},
					'inputImport': {
						text: [_('put the save code here.')],
						textarea: '',
						buttons: {
							'okay': {
								text: _('import'),
								nextScene: 'end',
								onChoose: Engine.import64
							},
							'cancel': {
								text: _('cancel'),
								nextScene: 'end'
							}
						}
					}
				}
			});
		},

		generateExport64: function(){
			var string64 = Base64.encode(localStorage.gameState);
			string64 = string64.replace(/\s/g, '');
			string64 = string64.replace(/\./g, '');
			string64 = string64.replace(/\n/g, '');

			return string64;
		},

		export64: function() {
			Engine.saveGame();
			Engine.enableSelection();
			return Engine.generateExport64();
		},

		import64: function(string64) {
			Engine.event('progress', 'import');
			Engine.disableSelection();
			string64 = string64.replace(/\s/g, '');
			string64 = string64.replace(/\./g, '');
			string64 = string64.replace(/\n/g, '');
			var decodedSave = Base64.decode(string64);
			localStorage.gameState = decodedSave;
			location.reload();
		},

		event: function(cat, act) {
			if(typeof ga === 'function') {
				ga('send', 'event', cat, act);
			}
		},

		confirmDelete: function() {
			Events.startEvent({
				title: _('Restart?'),
				scenes: {
					start: {
						text: [_('restart the game?')],
						buttons: {
							'yes': {
								text: _('yes'),
								nextScene: 'end',
								onChoose: Engine.deleteSave
							},
							'no': {
								text: _('no'),
								nextScene: 'end'
							}
						}
					}
				}
			});
		},

		deleteSave: function(noReload) {
			if(typeof Storage != 'undefined' && localStorage) {
				var prestige = Prestige.get();
				window.State = {};
				var lang = localStorage.lang;
				localStorage.clear();
				localStorage.lang = lang;
				Prestige.set(prestige);
			}
			if(!noReload) {
				location.reload();
			}
		},

		findStylesheet: function(title) {
			for(var i=0; i<document.styleSheets.length; i++) {
				var sheet = document.styleSheets[i];
				if(sheet.title == title) {
					return sheet;
				}
			}
			return null;
		},

		isLightsOff: function() {
			var darkCss = Engine.findStylesheet('darkenLights');
			if ( darkCss != null && !darkCss.disabled ) {
				return true;
			}
			return false;
		},

		turnLightsOff: function() {
			var darkCss = Engine.findStylesheet('darkenLights');
			if (darkCss == null) {
				$('head').append('<link rel="stylesheet" href="css/dark.css" type="text/css" title="darkenLights" />');
				$('.lightsOff').text(_('lights on.'));
				$SM.set('config.lightsOff', true, true);
			} else if (darkCss.disabled) {
				darkCss.disabled = false;
				$('.lightsOff').text(_('lights on.'));
				$SM.set('config.lightsOff', true,true);
			} else {
				$("#darkenLights").attr("disabled", "disabled");
				darkCss.disabled = true;
				$('.lightsOff').text(_('lights off.'));
				$SM.set('config.lightsOff', false, true);
			}
		},

		confirmExit: function(){
			Events.startEvent({
				title: _('Exit?'),
				scenes: {
					start: {
						text: [_('exit the game?')],
						buttons: {
							'yes': {
								text: _('yes'),
								nextScene: 'end',
								onChoose: Engine.exit
							},
							'no': {
								text: _('no'),
								nextScene: 'end'
							}
						}
					}
				}
			});
		},

		exit: function() {
			window.close();
		},

		triggerHyperMode: function() {
			Engine.options.doubleTime = !Engine.options.doubleTime;
			if(Engine.options.doubleTime)
				$('.hyper').text(_('classic.'));
			else
				$('.hyper').text(_('hyper.'));

			$SM.set('config.hyperMode', Engine.options.doubleTime, false);
		},

		// Gets a guid
		getGuid: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
				return v.toString(16);
			});
		},

		activeModule: null,

		travelTo: function(module) {
			if(Engine.activeModule != module) {
				var currentIndex = Engine.activeModule ? $('.location').index(Engine.activeModule.panel) : 1;
				$('div.headerButton').removeClass('selected');
				module.tab.addClass('selected');

				var slider = $('#locationSlider');
				var panelIndex = $('.location').index(module.panel);
				var diff = Math.abs(panelIndex - currentIndex);
				slider.animate({left: -(panelIndex * 700) + 'px'}, 300 * diff);

				if(Engine.activeModule == Room || Engine.activeModule == Path) {
					// Don't fade out the weapons if we're switching to a module
					// where we're going to keep showing them anyway.
					if (module != Room && module != Path) {
						$('div#weapons').animate({opacity: 0}, 300);
						$('div#village').animate({opacity: 1}, 300);
					}
				}

				if(module == Room || module == Path) {
					$('div#village').animate({opacity: 0}, 300);
					$('div#weapons').animate({opacity: 1}, 300);
				}

				Engine.activeModule = module;
				module.onArrival(diff);
				Notifications.printQueue(module);

			}
		},

		log: function(msg) {
			if(this._log) {
				console.log(msg);
			}
		},

		updateSlider: function() {
			var slider = $('#locationSlider');
			slider.width((slider.children().length * 700) + 'px');
		},

		updateOuterSlider: function() {
			var slider = $('#outerSlider');
			slider.width((slider.children().length * 700) + 'px');
		},

		getIncomeMsg: function(num, delay) {
			return _("{0} per {1}s", (num > 0 ? "+" : "") + num, delay);
			//return (num > 0 ? "+" : "") + num + " per " + delay + "s";
		},

		keyLock: false,
		tabNavigation: true,
		restoreNavigation: false,

		keyDown: function(e) {
			e = e || window.event;
			if(!Engine.keyPressed && !Engine.keyLock) {
				Engine.pressed = true;
				if(Engine.activeModule.keyDown) {
					Engine.activeModule.keyDown(e);
				}
			}
			return jQuery.inArray(e.keycode, [37,38,39,40]) < 0;
		},

		keyUp: function(e) {
			Engine.pressed = false;
			if(Engine.activeModule.keyUp) {
				Engine.activeModule.keyUp(e);
			} else {
				switch(e.which) {
					case 38: // Up
					case 87:
						if(Engine.activeModule == Outside || Engine.activeModule == Path) {
							Engine.activeModule.scrollSidebar('up');
						}
						Engine.log('up');
						break;
					case 40: // Down
					case 83:
						if (Engine.activeModule == Outside || Engine.activeModule == Path) {
							Engine.activeModule.scrollSidebar('down');
						}
						Engine.log('down');
						break;
					case 37: // Left
					case 65:
						if(Engine.tabNavigation){
							if(Engine.activeModule == Ship && Path.tab)
								Engine.travelTo(Path);
							else if(Engine.activeModule == Path && Outside.tab){
								Engine.activeModule.scrollSidebar('left', true);
								Engine.travelTo(Outside);
							}else if(Engine.activeModule == Outside && Room.tab){
								Engine.activeModule.scrollSidebar('left', true);
								Engine.travelTo(Room);
							}
						}
						Engine.log('left');
						break;
					case 39: // Right
					case 68:
						if(Engine.tabNavigation){
							if(Engine.activeModule == Room && Outside.tab)
								Engine.travelTo(Outside);
							else if(Engine.activeModule == Outside && Path.tab){
								Engine.activeModule.scrollSidebar('right', true);
								Engine.travelTo(Path);
							}else if(Engine.activeModule == Path && Ship.tab){
								Engine.activeModule.scrollSidebar('right', true);
								Engine.travelTo(Ship);
							}
						}
						Engine.log('right');
						break;

					case 27: // Escape
						if (!Engine.keyLock) {
							Engine.confirmExit();
						}
						break;
				}
			}
			if(Engine.restoreNavigation){
				Engine.tabNavigation = true;
				Engine.restoreNavigation = false;
			}
			return false;
		},

		swipeLeft: function(e) {
			if(Engine.activeModule.swipeLeft) {
				Engine.activeModule.swipeLeft(e);
			}
		},

		swipeRight: function(e) {
			if(Engine.activeModule.swipeRight) {
				Engine.activeModule.swipeRight(e);
			}
		},

		swipeUp: function(e) {
			if(Engine.activeModule.swipeUp) {
				Engine.activeModule.swipeUp(e);
			}
		},

		swipeDown: function(e) {
			if(Engine.activeModule.swipeDown) {
				Engine.activeModule.swipeDown(e);
			}
		},

		disableSelection: function() {
			document.onselectstart = eventNullifier; // this is for IE
			document.onmousedown = eventNullifier; // this is for the rest
		},

		enableSelection: function() {
			document.onselectstart = eventPassthrough;
			document.onmousedown = eventPassthrough;
		},

		autoSelect: function(selector) {
			$(selector).focus().select();
		},

		handleStateUpdates: function(e){

		},

		switchLanguage: function(dom){
			var lang = $(dom).data("language");
			if(document.location.href.search(/[\?\&]lang=[a-z_]+/) != -1){
				document.location.href = document.location.href.replace( /([\?\&]lang=)([a-z_]+)/gi , "$1"+lang );
			}else{
				document.location.href = document.location.href + ( (document.location.href.search(/\?/) != -1 )?"&":"?") + "lang="+lang;
			}
		},

		saveLanguage: function(){
			var lang = decodeURIComponent((new RegExp('[?|&]lang=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
			if(lang && typeof Storage != 'undefined' && localStorage) {
				localStorage.lang = lang;
			}
		},

		setInterval: function(callback, interval, skipDouble){
			if( Engine.options.doubleTime && !skipDouble ){
				Engine.log('Double time, cutting interval in half');
				interval /= 2;
			}

			return setInterval(callback, interval);

		},

		setTimeout: function(callback, timeout, skipDouble){

			if( Engine.options.doubleTime && !skipDouble ){
				Engine.log('Double time, cutting timeout in half');
				timeout /= 2;
			}

			return setTimeout(callback, timeout);

		}

	};

	function eventNullifier(e) {
		return $(e.target).hasClass('menuBtn');
	}

	function eventPassthrough(e) {
		return true;
	}

})();

function inView(dir, elem){

		var scTop = $('#main').offset().top;
		var scBot = scTop + $('#main').height();

		var elTop = elem.offset().top;
		var elBot = elTop + elem.height();

		if( dir == 'up' ){
				// STOP MOVING IF BOTTOM OF ELEMENT IS VISIBLE IN SCREEN
				return ( elBot < scBot );
		}else if( dir == 'down' ){
				return ( elTop > scTop );
		}else{
				return ( ( elBot <= scBot ) && ( elTop >= scTop ) );
		}

}

function scrollByX(elem, x){

		var elTop = parseInt( elem.css('top'), 10 );
		elem.css( 'top', ( elTop + x ) + "px" );

}


//create jQuery Callbacks() to handle object events
$.Dispatch = function( id ) {
	var callbacks, topic = id && Engine.topics[ id ];
	if ( !topic ) {
		callbacks = jQuery.Callbacks();
		topic = {
				publish: callbacks.fire,
				subscribe: callbacks.add,
				unsubscribe: callbacks.remove
		};
		if ( id ) {
			Engine.topics[ id ] = topic;
		}
	}
	return topic;
};

$(function() {
	Engine.init();
});
