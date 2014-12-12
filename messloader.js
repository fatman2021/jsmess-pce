var JSMESS = JSMESS || {};
JSMESS._readySet = false;
JSMESS._readyList = [];
JSMESS._runReadies = function() {
    if (JSMESS._readyList) {
	for (var r=0; r < JSMESS._readyList.length; r++) {
	    JSMESS._readyList[r].call(window, []);
	};
	JSMESS._readyList = [];
    };
};
JSMESS._readyCheck = function() {
    if (JSMESS.running) {
	JSMESS._runReadies();
    } else {
	JSMESS._readySet = setTimeout(JSMESS._readyCheck, 10);
    };
};
JSMESS.ready = function(r) {
    if (JSMESS.running) {
	r.call(window, []);
    } else {
	JSMESS._readyList.push(function() { return r.call(window, []); } );
	if (!(JSMESS._readySet)) JSMESS._readyCheck();
    };
};

var gamename = '';
var game_file = null;
var bios_filenames = '';
var bios_files = {};
var rom_datafile = 'pce-ibmpc.data';
var rom_data = null;
var rom_files = [
    { path: '/roms',     name: 'cas1.cas',               bytes: 17742 },
    { path: '/roms',     name: 'doswin.img',             bytes: 17825792 },
    { path: '/roms',     name: 'fd0.img',                bytes: 368640 },
    { path: '/roms',     name: 'fd1.pfdc',               bytes: 16681 },
    { path: '/roms',     name: 'parport1.out',           bytes: 0 },
    { path: '/roms',     name: 'parport2.out',           bytes: 0 },
    { path: '/roms',     name: 'pce-config.cfg',         bytes: 15309 },
    { path: '/roms',     name: 'serport1.out',           bytes: 0 },
    { path: '/roms',     name: 'speaker.wav',            bytes: 44 },
    { path: '/roms/rom', name: 'basic-1.10.rom',         bytes: 32768 },
    { path: '/roms/rom', name: 'dtc-hdc-1988-05-31.rom', bytes: 8192 },
    { path: '/roms/rom', name: 'genoa.rom',              bytes: 16384 },
    { path: '/roms/rom', name: 'ibm-hdc-1985-10-28.rom', bytes: 4096 },
    { path: '/roms/rom', name: 'ibm-pc-1982.rom',        bytes: 8192 },
    { path: '/roms/rom', name: 'ibm-xt-1982.rom',        bytes: 8192 },
    { path: '/roms/rom', name: 'ibmega.rom',             bytes: 16384 },
    { path: '/roms/rom', name: 'ibmpc-pcex.rom',         bytes: 1599 },
    { path: '/roms/rom', name: 'ibmvga.rom',             bytes: 24576 },
    { path: '/roms/rom', name: 'README',                 bytes: 505 },
    { path: '/roms/rom', name: 'sms-hdc-1986.rom',       bytes: 8192 },
    { path: '/roms/rom', name: 't9000b-pce.rom',         bytes: 32768 },
    { path: '/roms/rom', name: 't9000b.rom',             bytes: 32768 }
];
var file_countdown = 0;
if (bios_filenames.length !== 0 && bios_filenames[0] !== '') {
    file_countdown += bios_filenames.length;
}
if (rom_datafile !== '') {
    file_countdown += 1;
}
if (gamename !== '') {
    file_countdown++;
}

var newCanvas = document.createElement('canvas');
newCanvas.id = 'canvas';
newCanvas.width = 720;
newCanvas.height = 400;
var holder = document.getElementById('canvasholder');
holder.appendChild(newCanvas);

var fetch_file = function(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function(e) {
	var ints = new Int8Array(xhr.response);
	cb(ints);
    };
    xhr.send();
};

var Module = {
//    'arguments': ["bankp","-verbose","-rompath",".","-window","-resolution","224x224","-nokeepaspect","-autoframeskip"],
    print: (function() {
	var element = document.getElementById('output');
	return function(text) {
	    element.innerHTML += text + '<br>';
	};
    })(),
    canvas: document.getElementById('canvas'),
    SDL_numSimultaneouslyQueuedBuffers: 5,
    noInitialRun: false,
    screenIsReadOnly: true,
    setStatus: function(s) {
        console.log(s);
    },
    preInit: function() {
        // Load downloaded roms from data file into filesystem.
        Module['FS_createPath']('/', 'roms', true, true);
        Module['FS_createPath']('/roms', 'rom', true, true);
        var offset = 0;
        for (var r = 0; r < rom_files.length; r++) {
            var rom = rom_files[r];
            var data = rom_data.subarray(offset, offset + rom.bytes);
            var ptr = Module['_malloc'](rom.bytes);
            Module['HEAPU8'].set(data, ptr);
            var bytes = Module['HEAPU8'].subarray(ptr, ptr + rom.bytes);
            Module['FS_createDataFile'](rom.path, rom.name, bytes, true, true);
            offset += rom.bytes;
        }

	// Load the downloaded binary files into the filesystem.
	for (var bios_fname in bios_files) {
	    if (bios_files.hasOwnProperty(bios_fname)) {
		Module['FS_createDataFile']('/', bios_fname, bios_files[bios_fname], true, true);
	    }
	}
	if (gamename !== "") {
	    Module['FS_createDataFile']('/', gamename, game_file, true, true);
	}
	if (Modernizr.webaudio && !(Modernizr.mozsetup)) {
	    var asample;
	    try {
		asample = new AudioContext();
	    } catch (e) {
		asample = new webkitAudioContext();
	    }
//	    Module.arguments.push("-samplerate", asample.sampleRate.toString());
	}
    }
};

var update_countdown = function() {
    file_countdown -= 1;
    if (file_countdown === 0) {
        var headID = document.getElementsByTagName("head")[0];
	var newScript = document.createElement('script');
	newScript.type = 'text/javascript';
	newScript.src = 'pce.js';
	headID.appendChild(newScript);
    }
};

// Fetch the BIOS and the game we want to run.
for (var i=0; i < bios_filenames.length; i++) {
    var fname = bios_filenames[i];
    if (fname === "") {
        continue;
    }
    function getFunction(fname) {
        // Wrapper function to avoid binding fname to loop variable
        return function(data) { bios_files[fname] = data; update_countdown(); }
    }
    fetch_file(fname, getFunction(fname));
}

if (rom_datafile !== '') {
    fetch_file(rom_datafile, function(data) { rom_data = data; update_countdown(); });
}

if (gamename !== "") {
    fetch_file(gamename, function(data) { game_file = data; update_countdown(); });
}

window.addEventListener("keydown", function(e) {
    // space and arrow keys
    if([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
    }
}, false);
