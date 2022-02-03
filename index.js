const Discord = require("discord.js");
const { prefix, token, spotify_token } = require("./config.json");
const ytdl = require("ytdl-core");
const yts = require("yt-search");
const request = require("request");
const { default: axios } = require("axios");
const ytpl = require('ytpl');

// GLOBAL serverQueue
let serverQueue = null;

const client = new Discord.Client();
const queue = new Map();

client.once("ready", () => {
	console.log("Ready!");
});

client.once("reconnecting", () => {
	console.log("Reconnecting!");
});

client.once("disconnect", () => {
	console.log("Disconnect!");
});

client.on("message", async (message) => {
	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	if (message.content.startsWith(`${prefix}play `)) {
		execute(message);
		return;
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message);
		return;
	} else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message);
		return;
	} else if (message.content.startsWith(`${prefix}queue`) || message.content.trim() == `${prefix}q`) {
		listqueue(message);
		return;
	} else if (message.content.startsWith(`${prefix}lirik`)) {
		lirik(message);
		return;
	} else if (message.content.startsWith(`${prefix}loop`)) {
        setloop(message);
        return;
    } else if (message.content.startsWith(`${prefix}shuffle`)) {
        setShuffle(message);
        return;
    } else if (message.content.startsWith(`${prefix}karaoke`)) {
        setKaraoke(message);
        return;
    } else {
		message.channel.send(messageBuilder("Commandnya salah bebb!"));
	}
});

const validURL = (str) => {
	var pattern = new RegExp(
		"^(https?:\\/\\/)?" + // protocol
			"((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
			"((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
			"(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
			"(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
			"(\\#[-a-z\\d_]*)?$",
		"i"
	); // fragment locator
	return !!pattern.test(str);
}

const messageBuilder = (text) => {
	const embed = new Discord.MessageEmbed() // Ver 12.2.0 of Discord.js
	.setTitle("Anisa-Chan [Ariesta's Waifu]")
	.setDescription(text)
	.setColor(0x007bff);

	return embed;
}

const addSongsToPlaylist = async (message, youtubeURLS) => {
	serverQueue = queue.get(message.guild.id);

	youtubeURLS.forEach( async (url) => {
		const songInfo = await ytdl.getInfo(url);
		let duration = parseInt(songInfo.videoDetails.lengthSeconds / 60).toString() + ":" + parseInt(songInfo.videoDetails.lengthSeconds % 60).toString()

		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
			formats: songInfo.formats,
			duration: duration
		};

		const voiceChannel = message.member.voice.channel;
		if(typeof queue.get(message.guild.id) === 'undefined'){
			console.log("server queue new")
			const queueConstruct = {
				textChannel: message.channel,
				voiceChannel: voiceChannel,
				connection: null,
				songs: [],
				volume: 5,
				playing: false,
				first: true,
				loop: false,
				connected: false,
				currentIndex: 0,
				shuffle: false,
				karaoke: true
			};
	
			queue.set(message.guild.id, queueConstruct);
			queueConstruct.songs.push(song);
			
			// then play
			if(!queue.get(message.guild.id).connected){
				var connection = await voiceChannel.join();
				queue.get(message.guild.id).connected = true;
				queue.get(message.guild.id).connection = connection;
		
				play(message.guild, queue.get(message.guild.id).songs[0]);
			}
		}else{
			queue.get(message.guild.id).songs.push(song);
			// return message.channel.send(`${song.title} ditambahkan ke qu-EUE!`);
		}
	})
}

const execute = async (message) => {
	const arguments = message.content.split("anisa play ")[1].trim();

	const voiceChannel = message.member.voice.channel;
	if (!voiceChannel){
		return message.channel.send(
			"Kamu harus ada di voice channel untuk nge play!"
		);
	}

	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
		return message.channel.send(
			"Aku gakk punya ijin buat joinnn kaka >,<!"
		);
	}

	if(validURL(arguments)){
		if(arguments.includes("https://www.youtube.com/playlist")){ // Youtube playlist
			let urlID = arguments.split('=')[1];
			const playlist = await ytpl(urlID);
			let youtubeURLS = [];
			for(let i=0; i<playlist.items.length; i++){
				youtubeURLS.push(playlist.items[i].shortUrl);
			}
			await addSongsToPlaylist(message, youtubeURLS);
		}else if(arguments.includes("https://open.spotify.com/playlist/")){ // Spotify playlist

			let playlistID = arguments.split('https://open.spotify.com/playlist/')[1];
			if(playlistID.includes('?')){
				playlistID = playlistID.split('?')[0];
			}

			axios.get(`https://api.spotify.com/v1/playlists/${playlistID}/tracks`,
			{headers: {"Authorization" : `Bearer ${spotify_token}`}}).then((res) => {
				let songsTitle = [];
				res.data.items.forEach((item) => {
					let artist = item.track.artists.map(x => {
						return x.name
					}).join(", ");
					let title = item.track.name;
					let fullTitle = `${artist} - ${title}`;
					songsTitle.push(fullTitle);
				})
				
				songsTitle.forEach(async (title) => {
					const r = await yts(title);
					let youtubeURL = r.videos[0].url;
					await addSongsToPlaylist(message, [youtubeURL]);
				});
			}).catch((error) => {
				console.log(error);
				message.channel.send(messageBuilder(`invalid spotify playlistID kak! >,<~`));
			})
		}else if(arguments.includes("https://www.youtube.com/")){ // Normal Youtube URL
			await addSongsToPlaylist(message, [arguments]);
		}else{
			message.channel.send(
				"URL invalid kak! >,<~"
			);
		}
	}else{ // Song Title
		const r = await yts(arguments);
		let youtubeURL = r.videos[0].url;
		await addSongsToPlaylist(message, [youtubeURL]);
	}

	console.log("DONE server queue setted");

}

const skip = (message) => {
	serverQueue = queue.get(message.guild.id);

	if (!message.member.voice.channel)
		return message.channel.send(
			"Kamu harus ada di voice channel untuk bisa stop musiknya!"
		);
	if (!serverQueue)
		return message.channel.send("Nggak ada yg bisa di skip kaka >,<!");
	serverQueue.connection.dispatcher.end();
}

const stop = (message) => {
	serverQueue = queue.get(message.guild.id);
	if (!message.member.voice.channel){
		return message.channel.send(
			"Kamu harus ada di voice channel untuk bisa stop musiknya!"
		);
	}

	if (!serverQueue){
		return message.channel.send("Nggak ada yg bisa di skip kaka >,<!");
	}

	serverQueue.songs = [];
	serverQueue.connected = false;
	serverQueue.connection.dispatcher.end();
}

const randomInteger = (min, max) => {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

const play = async (guild, song) => {
	const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

	// let info = await ytdl.getInfo(song.url);
	// ytdl.chooseFormat(song.formats, { quality: "134" });

	const dispatcher = serverQueue.connection
		.play(ytdl(song.url, { filter: "audioonly" }))
		.on("finish", () => {
            if(!serverQueue.loop){
				serverQueue.songs.splice(serverQueue.currentIndex, 1);
                // serverQueue.songs.shift();
            }else{
				serverQueue.currentIndex++;
			}

			if(serverQueue.shuffle){
				serverQueue.currentIndex = randomInteger(0, serverQueue.songs.length-1);
			}

			if(serverQueue.currentIndex >= serverQueue.songs.length){
				serverQueue.currentIndex = 0;
			}
			play(guild, serverQueue.songs[serverQueue.currentIndex]);
		})
		.on("error", (error) => console.log("Normal error"));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(messageBuilder(`:arrow_forward: **Now Playing** : [${song.title}](${song.url}) [ ${song.duration} ]`));
	if(serverQueue.karaoke){
		let lirik = await requestLirik(song.title);
		serverQueue.textChannel.send(messageBuilder(lirik));
	}
}

const setloop = (message) => {
	serverQueue = queue.get(message.guild.id);
    if (!message.member.voice.channel)
        return message.channel.send(messageBuilder(
            "Kamu harus ada di voice channel untuk bisa jalanin commandnya!"
		));
    
    if (!serverQueue)
		return message.channel.send(messageBuilder("serverQueue kosong kk!"));

    
    serverQueue.loop = !serverQueue.loop;
    serverQueue.textChannel.send(messageBuilder(`Okee kakaa >,< | loop : **${serverQueue.loop}**`));
}

const setShuffle = (message) => {
	serverQueue = queue.get(message.guild.id);
    if (!message.member.voice.channel)
		return message.channel.send(messageBuilder(
			"Kamu harus ada di voice channel untuk bisa jalanin commandnya!"
		));
    
    if (!serverQueue)
        return message.channel.send(messageBuilder("serverQueue kosong kk!"));
    
    serverQueue.shuffle = !serverQueue.shuffle;
    serverQueue.textChannel.send(messageBuilder(`Okee kakaa >,< | shuffle : **${serverQueue.shuffle}**`));
}

const setKaraoke = (message) => {
	serverQueue = queue.get(message.guild.id);
    if (!message.member.voice.channel)
		return message.channel.send(messageBuilder(
			"Kamu harus ada di voice channel untuk bisa jalanin commandnya!"
		));
    
    if (!serverQueue)
        return message.channel.send(messageBuilder("serverQueue kosong kk!"));
    
    serverQueue.karaoke = !serverQueue.karaoke;
    serverQueue.textChannel.send(messageBuilder(`Okee kakaa >,< | karaoke : **${serverQueue.karaoke}**`));
}

const listqueue = (message) => {
	serverQueue = queue.get(message.guild.id);
	if (!serverQueue)
		return message.channel.send(messageBuilder("Nggak ada yg daftar musik kaka >,<!"));

	let rtr_message = "Lagu di qu-EUE : \n";
	let counter = 0;
	serverQueue.songs.forEach((song) => {
		counter = counter + 1;
		rtr_message += `${String(counter)}. [${song.title}](${song.url}) [${song.duration}]\n`;
	});
	return message.channel.send(messageBuilder(rtr_message));
}

const requestLirik = async (title) => {
	let out_lirik = `Lirik Lagu : **${title}**\n\n`;

	await axios.get("https://anisa-chan.nyakit.in/kapanlagi.php?title=" + encodeURIComponent(title))
	.then((res) => {
		let resp = res.data;
		if (!resp.error) {
			resp.lyrics.forEach((element) => {
				out_lirik += element + "\n";
			});
		} else {
			out_lirik += "Lirik tidak ditemukan, coba manual!";
		}
	}).catch((error) => {

	});
	return out_lirik;
}

const lirik = async (message) => {
	serverQueue = queue.get(message.guild.id);
	title = message.content.split("anisa lirik")[1];
	title = title.trim();

	if (title == "") {
		if (!serverQueue)
			return message.channel.send(messageBuilder("Nggak ada yg daftar musik kaka >,<!"));
		title = serverQueue.songs[0].title;
	}

	let lirik = await requestLirik(title);
	return message.channel.send(messageBuilder(lirik));
}

client.login(token);
