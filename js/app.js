$(document).ready(function () {

    var artists = [];
    var result;

    // add new class Artist
    class Artist {
        constructor(name) {
            this.searchData = Artist.getAllData(name);
            this.name = name;
            artists.push(this);
            this.index = artists.length - 1;
            this.getLastFMArist(this.searchData[0], this.index);
        }
        // function to establish AJAX call settings for first Last.fm search & Discogs Artist search
        static getAllData(name) {
            // Last.fm AJAX Artist search settings
            var lastFmSearch = {
                "async": true,
                "crossDomain": true,
                "url": "https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=" + name + "&api_key=d4a380aaf885c9d212b299849e585e3f&format=json",
                "method": "POST",
            };
            // Discogs AJAX artist search settings
            var discogsArtistSearch = {
                "async": true,
                "method": 'GET',
                "url": "https://api.discogs.com/database/search?title=" + name + "&type=artist&filter_anv=0&key=vvmuhSnCQoHKeXcTQCyv&secret=fxEdBZefCGdxmBWQyJwjkhxoTFcyMmYF",
                dataType: 'jsonp',
                crossDomain: true
            };
            var search = [lastFmSearch, discogsArtistSearch];
            return search;
        }
        // function to get basic Artist data from Last.fm
        getLastFMArist(searchData, index) {
            $.ajax(searchData).then(function (data) {
                artists[index].genres = data.artist.tags.tag;
                artists[index].similarArtists = data.artist.similar.artist;

                // get artist bio from Last.fm
                var bio = data.artist.bio.summary;
                // remove Last.fm link at end of bio
                var link = bio.search('<a href="https://www.last.fm/music/' + artists[index].name + '"');
                bio = bio.slice(0, link);
                // add bio to artists[index]
                artists[index].bio = bio;
            });
        }
        // function to get artist image and corrected name from Discogs
        getDiscogsArtist(name, resultData, callback) {
            var newData;
            var index;
            for (var i = 0; i < artists.length; i++) {
                if (name == artists[i].name) index = artists[i].index;
            }
            $.ajax(resultData).then(function (data) {
                var results = data.data.results;
                for (var i = 0; i < results.length; i++) {
                    if (results[i].title.toLowerCase() === name.toLowerCase()) {
                        newData = {
                            new: results[i].title,
                            img: results[i].cover_image
                        };
                    }
                }
                // corrects the name of artist (ex. if user typed in all uppercase) and add artist image
                artists[index].name = newData.new;
                artists[index].img = newData.img;

            }).done(function () {
                // run function getReleases()
                callback(newData.new, index);
            });
        }
        // function to get Artist album releases from Discogs
        getReleases(artist, index) {
            // AJAX search settings for searching albums by artist
            var discogsAlbumSearch = {
                async: true,
                method: 'GET',
                url: "https://api.discogs.com/database/search?artist=" + artist + "&format=album&type=master&key=vvmuhSnCQoHKeXcTQCyv&secret=fxEdBZefCGdxmBWQyJwjkhxoTFcyMmYF",
                dataType: 'jsonp',
                crossDomain: true
            };
            $.ajax(discogsAlbumSearch).then(function (data) {
                var releases = [];
                var results = data.data.results;
                var artistIsCorrect;
                for (var i = 0; i < results.length; i++) {
                    // makes sure album results used are of type 'master', and release is in US, Europe, or Canada
                    if (results[i].type == "master" && (results[i].country == "US" || results[i].country == "Europe" || results[i].country == "Canada")) {
                        // In the results, all albums are titled "{Artist} - {Album title}", but have no 'artist' property
                        // By making sure the index of the artist name in the result title is 0, we can make sure we have the right artist
                        if (results[i].title.indexOf(artist) == 0) artistIsCorrect = true;
                        // if(results[i].title.indexOf(t)==0) artistIsCorrect=true;
                        else artistIsCorrect = false;

                        // get the title of the album, and remove artist name and hyphen from album title
                        // In other words, remove "{Artist} - " from album title, and add that to our data
                        var title = results[i].title;
                        var num = title.indexOf(" - ") + 3;
                        title = title.slice(num);

                        // Make sure each result is not a duplicate of another result, as this happens with discogs a lot
                        var isDuplicate = false;
                        for (var j = 0; j < releases.length; j++) {
                            if (title == releases[j].title) {
                                isDuplicate = true;
                            }
                        }
                        // if result is not duplicate, and the artist is the right one, add new album
                        if (!isDuplicate && artistIsCorrect) {
                            var album = new Album(title, results[i].year);
                            album.getAlbumImg(title, artists[index].name, album);
                            releases.push(album);
                        }
                    }
                }
                // sort results by release year in ascending order, and add results as array to the artist's releases property
                releases.sort((a, b) => (a.release_year > b.release_year) ? 1 : -1);
                artists[index].releases = releases;
            });
        }
    }
    // add new class Album
    class Album {
        constructor(title, year) {
            this.title = title;
            this.release_year = year;
        }
        // function to get album cover image
        getAlbumImg(albName, artist, ret) {
            var img;
            // Search for album on Last.fm
            $.ajax({
                method: 'GET',
                url: "https://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=" + artist + "&album=" + albName + "&api_key=d4a380aaf885c9d212b299849e585e3f&format=json",
                withCredentials: true,
                dataType: 'jsonp',
                crossDomain: true
            }).then(function (data) {
                // Add 'mega' image to album info
                for (var i = 0; i < data.album.image.length; i++) {
                    if (data.album.image[i].size == "mega") img = data.album.image[i]['#text'];
                }
                ret.img = img;
                // run function getTracklist() on this album
                ret.getTracklist(data.album.tracks, ret);
            });
        }
        // function to get album tracklist
        getTracklist(data, ret) {
            var tracks = [];
            var numOfTracks = 0;
            for (var i = 0; i < data.track.length; i++) {
                // Convert length from seconds (ex: 168) to format m:ss (ex: 2:48)
                var lengthMin = Math.floor(parseInt(data.track[i].duration) / 60);
                var lengthSec = parseInt(data.track[i].duration) - (lengthMin * 60);
                // if lengthSec comes out to be a single digit, add a zero in front (ex: 6 -> 06)
                if (lengthSec <= 9 && lengthSec != 0) {
                    lengthSec = "0" + lengthSec;
                } else if (lengthSec == 0) {
                    lengthSec = "00";
                }
                var newTrack = {
                    number: (i + 1),
                    title: data.track[i].name,
                    length: lengthMin + ":" + lengthSec
                };
                tracks.push(newTrack);
                numOfTracks++;
            }
            if (tracks.length != 0) {
                ret.tracks = tracks;
                ret.numOfSongs = numOfTracks;
            }
        }
    }
    // function to add new Bootstrap Card element to page (new card, new card body, etc.)
    // type = 'card', 'body', etc.
    // 'part' is the element being appended
    function addCardElement(type, part, title) {
        if (type == "card") {
            // create new card with header (text being 'title'), and append to 'part'
            var newCard = $("<div>").addClass("card").attr('id', title.toLowerCase() + "-card");
            var cardHeader = $("<div>").addClass("card-header").text(title);
            newCard.append(cardHeader);
            part.append(newCard);
        } else if (type == "body") {
            // create new card body 
            var newBody = $("<div>").addClass("card-body").attr('id', title.toLowerCase() + "-body");
            // make header of Bio card be the artist name, otherwise have the header be the name of the div
            if (title == "Bio") var headerText = result.name;
            else var headerText = title;
            // create header, append to the new Body
            var bodyTitle = $("<h2>").addClass("card-title").text(headerText);
            newBody.append(bodyTitle);

            // append new Body to 'part'
            part.append(newBody);
        }
    }
    // function to add content to Bootstrap card element
    // 'to' is the element being appended
    // 'type' = 'text', 'list', 'image'
    // 'content' is the actual content being added
    // 'link' determines whether the new content is a link or not
    function addCardContent(to, type, content, link) {
        if (type == "text") {
            // create new <p>, with inner HTML of 'content', append to 'to'
            var cardText = $("<p>").addClass("card-text").html(content);
            to.append(cardText);
        } else if (type == "list") {
            // create new <ul> (unordered list)
            var newList = $("<ul>");
            for (var i = 0; i < content.length; i++) {
                if (link == "true") {
                    // if content are links, make sure the content put in each list item is a link
                    var listContent = $("<a href='#'>").addClass("artist-link").text(content[i].name);
                } else {
                    // otherwise, just add text of content
                    var listContent = content[i].name;
                }
                // create new <li> (list item), add new newList <ul>
                var listItem = $("<li>").html(listContent);
                newList.append(listItem);
            }
            // append newList to 'to'
            to.append(newList);
        } else if (type == "image") {
            // create new <img> (image) with source of 'content'
            var image = $("<img>").attr('src', content).addClass("card-img-top");
            to.append(image);
        }
    }
    // function to display info to the page ('d' being the result data)
    function showInfo(displayArea) {
        // Add bio card, add artist image
        addCardElement("card", $("#bio"), "Bio");
        addCardContent($("#bio-card"), "image", displayArea.img, "false");
        // Add body to bio card, with text of artist bio
        addCardElement("body", $("#bio-card"), "Bio");
        addCardContent($("#bio-body"), "text", displayArea.bio);
        // Add music card, and new body thereto, entitled "Genres". In new genres-body, put list of artist genres
        addCardElement("card", $("#music"), "Music");
        addCardElement("body", $("#music-card"), "Genres");
        addCardContent($("#genres-body"), "list", displayArea.genres, "false");
        // Add new body to music card for similar artists, link each artist
        addCardElement("body", $("#music-card"), "Similar");
        addCardContent($("#similar-body"), "list", displayArea.similarArtists, "true");
    }
    // function to append artist discography to the bottom of the page, 'r' being artist releases
    function showDiscography(record) {
        // add new <div> for discography, put a Bootstrap jumbotron component inside
        var discoSection = $("<div>").addClass("row").attr('id', 'disco-section');
        var discJumbo = $("<div>").addClass("jumbotron jumbotron-fluid").attr('id', 'disco-jumbotron').css('padding-left','10px');
        // add header to new jumbotron, add new list to jumbotron
        var discoList = $("<ul>").addClass("list-unstyled");
        // for each album, create new <li> element in discoList
        for (var i = 0; i < record.length; i++) {
            var discoAlbum = $("<li>").addClass("media");
            var discoAlbumBody = $("<div>").addClass("media-body");
            // Create new header, with text of album title, and a subheader for the release year
            var albumHeader = $("<br><h5>").addClass("mt-0 mb-1").text(record[i].title).css('padding-left','5px');
            discoAlbumBody.append(albumHeader);
            var discoAlbumText = $("<p>").text("Release Year: " + record[i].release_year).css('padding-left','5px');
            discoAlbumBody.append(discoAlbumText);
            // create new list for each track
            var tracklisting = $("<ul>").addClass("list-unstyled").css('padding-left','5px');
            for (var j = 0; j < record[i].numOfSongs; j++) {
                var newTrack = record[i].tracks[j].title;
                var newTrackNum = record[i].tracks[j].number;
                var newTrackLength = record[i].tracks[j].length;
                // create new <li> (list item) with text in this format. Example: '1) Smashed to Pieces (3:43)
                var newItem = $("<li>").text(newTrackNum + ") - " + newTrack + " (" + newTrackLength + ")");
                tracklisting.append(newItem);
            }
            // add tracklisting to each album body in discography
            discoAlbumBody.append(tracklisting);
            discoAlbum.append(discoAlbumBody);
            discoAlbum.append($("<img>").addClass("mr-3 center").attr('src', record[i].img).attr('height','200px').attr('width','200px').attr('alt',"Album cover"));
            discoAlbum.append("<hr>");
            discoList.append(discoAlbum);
        }
        // add discoList to jumbotron, add jumbotron to discoSection <div>, add discoSection to HTML body
        discJumbo.append("<h3>Discography</h3>").attr('id', 'discog');
        discJumbo.append(discoList);
        discoSection.append(discJumbo);
        $(".container").append(discoSection);
    }
    // Search button on-click function
    $("#btnFetch").click(function (e) {
        e.preventDefault();
        // Declare & assign new variable to value of user input in Search input bar, and run function clickedSearch with that as parameter
        var searchArtist = $("#search-term").val().trim();
        // clickedSearch(search);
        clickedSearch(searchArtist);
    });
    // On-click function for links found in similar Artists div
    $(document.body).on("click", ".artist-link", function (e) {
        e.preventDefault();
        // Declare & assign new variable to text content of the link clicked by user, and run function clickedSearch with that as parameter
        var searchSimArt = this.textContent;
        $("#search-term").val(searchSimArt)
        clickedSearch(searchSimArt);
    });
    // function clickedSearch(t) {
    function clickedSearch(name) {
        // Reset the page to default content
        $("#bio").empty();
        $("#music").empty();
        $("#disco-section").remove();
        // var spinner = $("<span>").addClass("spinner-grow spinner-grow-sm").attr('role','status').attr('aria-hidden','true');
        $("#spinner").css('display','inline-flex');
        $("#btnText").text("Loading...");
        $("#btnFetch").attr('disabled',true);
        // create new Artist for result
        result = new Artist(name);
        result.getDiscogsArtist(name, result.searchData[1], result.getReleases);
        // display all info to page
        setTimeout(function () {
            showInfo(result);
        }, 1000);
        setTimeout(function () {
            showDiscography(result.releases);
        }, 2000);
        setTimeout(function() {
            $("#spinner").css('display','none');
            $("#btnText").text("Search");
            $("#btnFetch").attr('disabled',false);
        },2500);
    }
    // use var cnt to simplify keeping track of change condition
    var cnt = 1;
    // changes text and background color of header every 3 sec
    function changeColor() {
        // if cnt === 1 change initial css image
        if (cnt === 1) {
            $("h1").css("color", "aqua");
            $("#banner").css("background-color", "black");
            cnt = 2;
        }
        else {
            // change back to original image
            $("h1").css("color", "white");
            $("#banner").css("background-color", "grey");
            cnt = 1;
        }
    }
    // start changeColor
    setInterval(changeColor, 3000);
});