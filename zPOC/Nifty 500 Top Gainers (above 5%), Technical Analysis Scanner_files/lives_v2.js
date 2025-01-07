var xmlobj = createobject(), refs, oKeyword = "s", searchbox = "", resultscache = {}, ctime;
function cancelall() {
	xmlobj.abort()
}
function loadFrame() {
	var a              = document.getElementById( "sbox" ), b = document.getElementById( "DivShim" );
	b.style.visibility = "visible";
	document.getElementById( "sbox" ).innerHTML.length < 1 ? b.style.visibility = "hidden" : (b.style.position = "absolute", b.style.width = a.offsetWidth, b.style.height = a.offsetHeight, b.style.top = a.style.top, b.style.left = a.style.left, b.style.zIndex = a.style.zIndex - 1, b.style.display = "")
}
function createobject() {
	var a;
	try {
		a = new XMLHttpRequest
	} catch( b ) {
		for( var c = ["MSXML2.XMLHTTP.6.0", "MSXML2.XMLHTTP.5.0", "MSXML2.XMLHTTP.4.0", "MSXML2.XMLHTTP.3.0", "MSXML2.XMLHTTP", "Microsoft.XMLHTTP"], d = 0; d < c.length; d++ )try {
			a = new ActiveXObject( c[d] )
		} catch( e ) {
		}
	}
	if( a )return a; else alert( "cannt create object" )
}
function init() {
	refs = document.getElementById( "sbox" );
	ref2 = document.getElementById( "searchbox" );
	ref2.setAttribute( "autocomplete", "off" );
	ref2.value = "";
	ref2.focus();
	searchbox = document.search.searchbox;
}
function refresh() {
	if( searchbox.value == "" )refs.innerHTML = "", document.getElementById( "sbox" ).style.visibility = "hidden";
	if( oKeyword != searchbox.value & searchbox.value != "" )oKeyword = searchbox.value, getsuggesstions();
	loadFrame()
}
function checkcache() {
	refs.innerHTML = "";
	if( !resultscache[oKeyword] )for( i = 0; i < oKeyword.length; i++ )if( resultscache[oKeyword.substring( 0, oKeyword.length - i )] ) {
		var a = oKeyword.substring( 0, oKeyword.length - i );
		temp  = resultscache[a];
		for( var b = a = 0; b < temp.length; b++ )temp[b].toLowerCase().indexOf( oKeyword ) == 0 && (resultscache[oKeyword] || (resultscache[oKeyword] = []), resultscache[oKeyword][a] = temp[b], a++);
		break
	}
	return resultscache[oKeyword] ? !0 : !1
}

function getsuggesstions() {
	var a           = 1;
	oKeyword        = encodeURIComponent( decodeURIComponent( trim( oKeyword ) )  );
	searchbox.value = (searchbox.value);
	xmlobj && !checkcache() && (a = 0, 4 == xmlobj.readyState || 0 == xmlobj.readyState ? (xmlobj.open( "GET", "//" + location.hostname +"/search_stocks/ajax?term=" + oKeyword, !0 ), xmlobj.onreadystatechange = handlegetsuggesstions, xmlobj.send( null )) : setTimeout( "getsuggesstions()", 200 ));
	1 == a && displaycache();
};

function trim( a ) {
	return a.replace( /^\s+|\s+$/g, "" )
}
function rtrim( a ) {
	return a.replace( /\s+$/, "" )
}
function displaycache() {
	if( resultscache[oKeyword].length > 0 ) {
		var a = "<ul class='autocomplete'>";
		for( i = 0; i < resultscache[oKeyword].length; i++ ) {
			var b = resultscache[oKeyword][i].split( "," );
			b.length > 1 && (b[1] = trim( b[1] ).toLowerCase());

			if(document.search.type.value == "can" ) {
				a = a + "<li><a href='//"+location.hostname+"/stocks/" + encodeURIComponent(b[1]) + ".html'>"+ (b[0]) + "</a></li>";
			}else if(document.search.type.value == "po") {
				a = a + "<li><a href='//"+location.hostname+"/pointfigure/" + encodeURIComponent(b[1]) + ".html'>"+ (b[0]) + "</a></li>";
			} else {
				a = a + "<li><a href='//"+location.hostname+"/fundamentals/" + encodeURIComponent(b[1]) + ".html'>"+ (b[0]) + "</a></li>";
			}

		}
		refs.innerHTML                                     = a +"</ul>";
		document.getElementById( "sbox" ).style.visibility = "visible"
	}
}
function displayfetched( a ) {
	a = a.split( "<BR>" );
	if( a.length > 0 ) {
		document.getElementById( "sbox" ).style.visibility = "visible";
		var b                                              = "<ul class='autocomplete'>";
		for( i = 0; i < a.length; i++ ) {
			var c = a[i].split( "," );
			c.length > 1 && (c[1] = trim( c[1] ).toLowerCase());

			if(document.search.type.value == "can" ) {
				b = b + "<li><a href='//"+location.hostname+"/stocks/" + encodeURIComponent(c[1]) + ".html'>"+ (c[0]) + "</a></li>";
			}else if(document.search.type.value == "po") {
				b = b +"<li><a href='//"+location.hostname+"/pointfigure/" + encodeURIComponent(c[1]) + ".html'>"+ (c[0]) + "</a></li>";
			} else {
				b = b +"<li><a href='//"+location.hostname+"/fundamentals/" + encodeURIComponent(c[1]) + ".html'>"+ (c[0]) + "</a></li>";
			}
		}
		refs.innerHTML = b + "</ul>";
	}
}
function getchart( a ) {
	document.getElementById( "sbox" ).style.visibility = "hidden";
	document.search.selector.value                     = a;
	document.search.submit();
	oKeyword = a
}
function handlegetsuggesstions() {
	if( xmlobj.readyState == 4 ) {
		displayfetched( xmlobj.responseText );
		var a                  = xmlobj.responseText.split( "<BR>" );
		resultscache[oKeyword] = [];
		for( i = 0; i < a.length; i++ )resultscache[oKeyword][i] = a[i]
	}
};