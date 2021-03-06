// See: http://www.crockford.com/javascript/jslint.html
/*global alert, window, document, navigator, DOMParser, XMLHttpRequest */

/**
 * Declare a constructor function to which we can add real functions.
 * @constructor
 */

function DWREngine()
{
}

/**
 * Constants to pick the XMLHttpRequest remoting method.
 * For example:
 * <code>DWREngine.setMethod(DWREngine.XMLHttpRequest);</code>
 * @see DWREngine.setMethod()
 * @see DWREngine.IFrame
 */
DWREngine.XMLHttpRequest = 1;


/**
 * Constants to pick the iframe remoting method.
 * For example:
 * <code>DWREngine.setMethod(DWREngine.IFrame);</code>
 * @see DWREngine.setMethod()
 * @see DWREngine.XMLHttpRequest
 */
DWREngine.IFrame = 2;

/**
 * The default error handler displays an alert box, but that is not correct
 * for all applications, so this method allows you to set an alternative
 * error handler.
 * By default there is no error handler set.
 * @param handler A function to call with single an error parameter on failure
 * @see DWREngine.defaultMessageHandler()
 */
DWREngine.setErrorHandler = function(handler)
{
    DWREngine._errorHandler = handler;
};




/**
 * The default warning handler displays an alert box, but that is not correct
 * for all applications, so this method allows you to set an alternative
 * warning handler.
 * By default there is no error handler set.
 * @param handler A function to call with single an warning parameter on failure
 * @see DWREngine.defaultMessageHandler()
 */
DWREngine.setWarningHandler = function(handler)
{
    DWREngine._warningHandler = handler;
};


/**
 * The Pre-Hook is called before any DWR remoting is done.
 * Pre hooks can be useful for displaying "please wait" messages.
 * @param handler A function to call with no params before remoting
 * @see DWREngine.setPostHook()
 */
DWREngine.setPreHook = function(handler)
{
    DWREngine._preHook = handler;
};

/**
 * The Post-Hook is called after any DWR remoting is done.
 * Pre hooks can be useful for removing "please wait" messages.
 * @param handler A function to call with no params after remoting
 * @see DWREngine.setPreHook()
 */
DWREngine.setPostHook = function(handler)
{
    DWREngine._postHook = handler;
};

/**
 * Set the preferred remoting method.
 * setMethod does not guarantee that the selected method will be used, just that
 * we will try that method first.
 * @param newmethod One of DWREngine.XMLHttpRequest or DWREngine.IFrame
 */
DWREngine.setMethod = function(newmethod)
{
    if (newmethod != DWREngine.XMLHttpRequest && newmethod != DWREngine.IFrame)
    {
        if (DWREngine._errorHandler)
        {
            DWREngine._errorHandler("Remoting method must be one of DWREngine.XMLHttpRequest or DWREngine.IFrame");
        }

        return;
    }

    DWREngine._method = newmethod;
};

/**
 * Which HTTP verb do we use so send results?
 * Must be one of "GET" or "POST".
 * @param verb the new HTTP verb.
 */
DWREngine.setVerb = function(verb)
{
    if (verb != "GET" && verb != "POST")
    {
        if (DWREngine._errorHandler)
        {
            DWREngine._errorHandler("Remoting verb must be one of GET or POST");
        }

        return;
    }

    DWREngine._verb = verb;
};

/**
 * Do we attempt to ensure that remote calls happen in the order in which they
 * were sent? (Default: false)
 * Warning: Setting this to true will slow down your application, and could
 * leave users with an unresponsive browser if a message gets lost.
 * Sometimes there are better solutions where you make your application use the
 * asynchronous model properly. Please think before you use this method.
 * @param ordered true or false
 */
DWREngine.setOrdered = function(ordered)
{
    DWREngine._ordered = ordered;
};

/**
 * The default message handler.
 * Useful in calls to setErrorHandler() or setWarningHandler() to allow you to
 * get the default back.
 * @param message The message to display to the user somehow
 */
DWREngine.defaultMessageHandler = function(message)
{
    if (typeof message == "object" && message.name == "Error" && message.description)
    {
        alert("Error: " + message.description);
    }
    else
    {
        alert(message);
    }
};

/**
 * You can group several remote calls together using a batch.
 * This saves on round trips to the server so there is much less latency involved.
 * @see DWREngine.endBatch()
 */
DWREngine.beginBatch = function()
{
    if (DWREngine._batch)
    {
        if (DWREngine._errorHandler)
        {
            DWREngine._errorHandler("Batch already started.");
        }

        return;
    }

    // Setup a batch
    DWREngine._batch = {};
    DWREngine._batch.map = {};
    DWREngine._batch.paramCount = 0;
    DWREngine._batch.map.callCount = 0;
    DWREngine._batch.metadata = {};
};

/**
 * We are finished grouping a set of remote calls together, now go and execute
 * them all.
 */
DWREngine.endBatch = function()
{
    if (DWREngine._batch == null)
    {
        if (DWREngine._errorHandler)
        {
            DWREngine._errorHandler("No batch in progress.");
        }

        return;
    }


    // If we are in ordered mode, then we don't send unless the list of sent
    // items is empty
    if (!DWREngine._ordered)
    {
        DWREngine._sendData(DWREngine._batch);
        DWREngine._batches[DWREngine._batches.length] = DWREngine._batch;
    }
    else
    {
        if (DWREngine._batches.length == 0)
        {
            // We aren't waiting for anything, go now.
            DWREngine._sendData(DWREngine._batch);
            DWREngine._batches[DWREngine._batches.length] = DWREngine._batch;
        }
        else
        {
            // Push the batch onto the waiting queue
            DWREngine._batchQueue[DWREngine._batchQueue.length] = DWREngine._batch;
        }
    }

    DWREngine._batch = null;
};

//==============================================================================
// Only private stuff below here
//==============================================================================


/**
 * A function to call if something fails.
 * @private
 */
DWREngine._errorHandler = DWREngine.defaultMessageHandler;

/**
 * A function to call to alert the user to some breakage.
 * @private
 */
DWREngine._warningHandler = DWREngine.defaultMessageHandler;

/**
 * A function to be called before requests are marshalled. Can be null.
 * @private
 */
DWREngine._preHook = null;

/**
 * A function to be called after replies are received. Can be null.
 * @private
 */
DWREngine._postHook = null;

/**
 * An array of the batches that we have sent and are awaiting a reply on.
 * @private
 */
DWREngine._batches = [];

/**
 * An array of batches that we'd like to send, but because we are in ordered
 * mode we won't until the current batch has been returned.
 * @private
 */
DWREngine._batchQueue = [];

/**
 * A map of all the known current batches
 * @private
 */
DWREngine._callbacks = {};

/**
 * What is the default remoting method
 * @private
 */
DWREngine._method = DWREngine.XMLHttpRequest;

/**
 * What is the default remoting verb (ie GET or POST)
 * @private
 */
DWREngine._verb = "POST";

/**
 * Do we attempt to ensure that remote calls happen in the order in which they
 * were sent?
 * @private
 */
DWREngine._ordered = false;

/**
 * The current batch (if we are in batch mode)
 * @private
 */
DWREngine._batch = null;

/**
 * Called when the replies are received.
 * This method is called by Javascript that is emitted by server
 * @param id The identifier of the call that we are handling a response for
 * @param reply The data to pass to the callback function
 * @private
 */
DWREngine._handleResponse = function(id, reply, httpRequestAllowed, authenticated, sessionValidated)
{
    var func = DWREngine._callbacks[id];

    // Clear this callback out of the list - we don't need it any more
    DWREngine._callbacks[id] = null;

    if (func)
    {
        // Error handlers inside here indicate an error that is nothing to do
        // with DWR so we handle them differently.
        try
        {
			if (!httpRequestAllowed)
			{
				DWREngine._httpRequestMethodDenied("Request Denied");
			}
			else if (!authenticated)
			{
				DWREngine._authenticationFailureHandler("Client Authentication failed");
			}
			else if (!sessionValidated)
			{
				DWREngine._sessionAuthenticationFailureHandler("Session Authentication failed");
			}
			else
			{
	            func(reply);
			}
        }
        catch (ex)
        {
            if (DWREngine._errorHandler)
            {
                DWREngine._errorHandler(ex);
            }
        }
    }
    else
    {
        // If there is no reply then we don;t worry about warning for a missing
        // callback function.
        if (reply)
        {
            if (DWREngine._warningHandler)
            {
                 //DWREngine._warningHandler("Internal Error: Missing callback for id='" + id + "'");
            }
        }
    }
};

/**
 * Called when errors are received.
 * This method is called by Javascript that is emitted by server
 * @private
 */
DWREngine._handleError = function(id, reason)
{
    if (DWREngine._errorHandler)
    {
        DWREngine._errorHandler(reason);
    }
};

/**
 * Call right at the end of a batch being executed to clear up
 * @param batch The batch to tidy up after
 * @private
 */
DWREngine._finalize = function(batch)
{
    DWREngine._removeNode(batch.div);
    DWREngine._removeNode(batch.iframe);
    DWREngine._removeNode(batch.form);

    if (DWREngine._postHook)
    {
        DWREngine._postHook();
    }

    // TODO: There must be a better way???
    for (var i = 0; i < DWREngine._batches.length; i++)
    {
        if (DWREngine._batches[i] == batch)
        {
            DWREngine._batches.splice(i, 1);
            break;
        }
    }

    // If there is anything on the queue waiting to go out, then send it.
    // We don't need to check for ordered mode, here because when ordered mode
    // gets turned off, we still process *waiting* batches in an ordered way.
    if (DWREngine._batchQueue.length != 0)
    {
        var batch = DWREngine._batchQueue.shift();
        DWREngine._sendData(batch);
        DWREngine._batches[DWREngine._batches.length] = batch;
    }
};

/**
 * Remove a node from a document.
 * @param node the node to remove from the document that it's part of.
 * @private
 */
DWREngine._removeNode = function(node)
{
    if (node)
    {
        node.parentNode.removeChild(node);
    }
};

/**
 * Send a request to the server
 * This method is called by Javascript that is emitted by server
 * @param path The part of the URL after the host and before the exec bit
 *             without leading or trailing /s
 * @param scriptName The class to execute
 * @param methodName The method on said class to execute
 * @param func The callback function to which any returned data should be passed
 *             if this is null, any returned data will be ignored
 * @param vararg_params The parameters to pass to the above class
 * @private
 */
DWREngine._execute = function(path, scriptName, methodName, vararg_params)
{
    var singleShot = false;
    if (DWREngine._batch == null)
    {
        DWREngine.beginBatch();
        singleShot = true;
    }

    // To make them easy to manipulate we copy the arguments into an args array
    var args = [];
    for (var i = 0; i < arguments.length - 3; i++)
    {
        args[i] = arguments[i + 3];
    }

    // All the paths MUST be to the same servlet
    if (DWREngine._batch.path == null)
    {
        DWREngine._batch.path = path;
    }
    else
    {
        if (DWREngine._batch.path != path)
        {
            if (DWREngine._errorHandler)
            {
                DWREngine._errorHandler("Can't batch requests to multiple DWR Servlets.");
            }

            return;
        }
    }

    // From the other params, work out which is the function (or object with
    // call meta-data) and which is the call parameters
    var func;
    var params;
    var metadata;

    var firstArg = args[0];
    var lastArg = args[args.length - 1];
    
    if (typeof firstArg == "function")
    {
        func = args.shift();
        params = args;
        metadata = {};
    }
    else if (typeof lastArg == "function")
    {
        func = args.pop();
        params = args;
        metadata = {};
    }
    else if (typeof lastArg == "object" && lastArg.callback != null && typeof lastArg.callback == "function")
    {
        metadata = args.pop();
        params = args;
        func = metadata.callback;
    }
    else if (firstArg == null)
    {
        // This could be a null callback function, but if the last arg is also
        // null then we can't tell which is the function unless there are only
        // 2 args, in which case we don't care!
        if (lastArg == null && args.length > 2)
        {
            if (DWREngine._warningHandler)
            {
                DWREngine._warningHandler("Ambiguous nulls at start and end of parameter list. Which is the callback function?");
            }
        }

        func = args.shift();
        params = args;
        metadata = {};
    }
    else if (lastArg == null)
    {
        func = args.pop();
        params = args;
        metadata = {};
    }
    else
    {
        if (DWREngine._warningHandler)
        {
            DWREngine._warningHandler("Missing callback function or metadata object.");
        }

        return;
    }

    // Get a unique ID for this call
    var random = Math.floor(Math.random() * 10001);
    var id = (random + "_" + new Date().getTime()).toString();
    // var id = DWREngine._batches.length;
    // var id = idbase++;
   
    DWREngine._callbacks[id] = func;

    var prefix = "c" + DWREngine._batch.map.callCount + "-";

    // merge the metadata from this call into the batch
    if (metadata != null)
    {
        for (var prop in metadata)
        {
            DWREngine._batch.metadata[prop] = metadata[prop];
        }
    }

    DWREngine._batch.map[prefix + "scriptName"] = scriptName;
    DWREngine._batch.map[prefix + "methodName"] = methodName;
    DWREngine._batch.map[prefix + "id"] = id;

    // Serialize the parameters into batch.map
    DWREngine._addSerializeFunctions();
    for (i = 0; i < params.length; i++)
    {
        DWREngine._serializeAll(DWREngine._batch, [], params[i], prefix + "param" + i);
    }
    DWREngine._removeSerializeFunctions();

    // Now we have finished remembering the call, we incr the call count
    DWREngine._batch.map.callCount++;

    if (singleShot)
    {
        DWREngine.endBatch();
    }
};

/**
 * Called as a result of a request timeout or an http reply status != 200
 * @param batch Block of data about the calls we are making on the server
 * @private
 */ 
DWREngine._abortRequest = function(batch)
{
    if (batch && batch.metadata && batch.completed != true)
    {
        batch.completed = true;
        if (batch.req != null)
        {
            batch.req.abort();

            if (batch.metadata.errorHandler)
            {
                if (typeof batch.metadata.errorHandler == "string")
                {
                    eval(batch.metadata.errorHandler); 
                }
                else if (typeof batch.metadata.errorHandler == "function")
                {
                    batch.metadata.errorHandler(); 
                }
                else
                {
                    if (DWREngine._warningHandler)
                    {
                        DWREngine._warningHandler("errorHandler is neither a string (for eval()) or a function.");
                    }
                }
            }
        }
    }
};

/**
 * Actually send the block of data in the batch object.
 * @param batch Block of data about the calls we are making on the server
 * @private
 */
DWREngine._sendData = function(batch)
{
    // Actually make the call
    if (DWREngine._preHook)
    {
        DWREngine._preHook();
    }

    // Set a timeout
    if (batch.metadata && batch.metadata.timeout)
    {
        var funcReq = function() { DWREngine._abortRequest(batch); };
        setTimeout(funcReq, batch.metadata.timeout);
	}

    // Get setup for XMLHttpRequest if possible
    if (DWREngine._method == DWREngine.XMLHttpRequest)
    {
        if (window.XMLHttpRequest)
        {
            batch.req = new XMLHttpRequest();
        }
        // IE5 for the mac claims to support window.ActiveXObject, but throws an error when it's used
        else if (window.ActiveXObject && !(navigator.userAgent.indexOf('Mac') >= 0 && navigator.userAgent.indexOf("MSIE") >= 0))
        {
            batch.req = new window.ActiveXObject("Microsoft.XMLHTTP");
        }
    }

    // A quick string to help people that use web log analysers
    var statsInfo;
    if (batch.map.callCount == 1)
    {
        statsInfo = batch.map["c0-scriptName"] + "." + batch.map["c0-methodName"];
    }
    else
    {
        statsInfo = "Multiple." + batch.map.callCount;
    }

	var query = "ajax=true&";
    var prop;

    if (batch.req)
    {
        batch.map.xml = true;
		

        // Proceed using XMLHttpRequest
        batch.req.onreadystatechange = function() { DWREngine._stateChange(batch); };

        // Force Mac people to use GET because Safari is broken.
        if (DWREngine._verb == "GET" || navigator.userAgent.indexOf('Safari') >= 0)
        {
			//add authentication Key
			query += encodeURIComponent("clientAuthenticationKey") + "=" + encodeURIComponent(DWREngine.clientAuthenticationKey) + "&";

			for (prop in batch.map)
            {
                query += encodeURIComponent(prop) + "=" + encodeURIComponent(batch.map[prop]) + "&";
            }
            query = query.substring(0, query.length - 1);
			
            try
            {
                batch.req.open("GET", batch.path + "?" + query);
                batch.req.send(null);
            }
            catch (ex)
            {
                if (DWREngine._errorHandler)
                {
                    DWREngine._errorHandler(ex);
                }
            }
        }
        else
        {
			//add authentication Key
			query += "clientAuthenticationKey" + "=" + encodeURIComponent(DWREngine.clientAuthenticationKey) + "&";
            for (prop in batch.map)
            {
                query += prop + "=" + batch.map[prop] + "&";
            }

            try
            {
				batch.req.open("POST", batch.path + "?" + statsInfo, true);
				batch.req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");			
                batch.req.send(query);
            }
            catch (ex)
            {
                if (DWREngine._errorHandler)
                {
                    DWREngine._errorHandler(ex);
                }
            }
        }
    }
    else
    {
        batch.map.xml = false;

        var idname = "dwr-if-" + batch.map["c0-id"];

        // Proceed using iframe
        batch.div = document.createElement('div');
        batch.div.innerHTML = "<iframe id='" + idname + "' name='" + idname + "'></iframe>";
        document.body.appendChild(batch.div);
        batch.iframe = document.getElementById(idname);
        batch.iframe.setAttribute('style', 'width:0px; height:0px; border:0px;');

        if (DWREngine._verb == "GET")
        {
            for (prop in batch.map)
            {
                query += encodeURIComponent(prop) + "=" + encodeURIComponent(batch.map[prop]) + "&";
            }
            query = query.substring(0, query.length - 1);

            batch.iframe.setAttribute('src', batch.path + "?" + query);
            document.body.appendChild(batch.iframe);
        }
        else
        {
            batch.form = document.createElement('form');
            batch.form.setAttribute('id', 'dwr-form');
            batch.form.setAttribute('action', batch.path);
            batch.form.setAttribute('target', idname);
            batch.form.target = idname;
            batch.form.setAttribute('method', 'post');
            for (prop in batch.map)
            {
                var formInput = document.createElement('input');
                formInput.setAttribute('type', 'hidden');
                formInput.setAttribute('name', prop);
                formInput.setAttribute('value', batch.map[prop]);
                batch.form.appendChild(formInput);
            }

            document.body.appendChild(batch.form);
            batch.form.submit();
        }
    }
};

/**
 * Called by XMLHttpRequest to indicate that something has happened
 * @private
 */
DWREngine._stateChange = function(batch)
{
    if (batch.req.readyState == 4)
    {
        try
        {
            if (batch.req.status && batch.req.status == 200)
            {
                batch.completed = true;
				
				var response = batch.req.responseText;
				if (response.indexOf("****/") > 0)  response = "/****" + response;
				var footerPos = response.indexOf("/* EOF CFAJAX */");
				if (footerPos > 0) response = response.substring(0, footerPos);
                eval(response);
            }
            else
            {
				///////////////////////////document.frm.error.value = batch.req.responseText;
                if (batch.metadata != null)
                {
                    DWREngine._abortRequest(batch);
                }
                else if (DWREngine._errorHandler)
                {
					var response = batch.req.responseText;
					if (response.indexOf("****/") > 0)  response = "/****" + response;
                    DWREngine._errorHandler(response);
                }
            }
        }
        catch (ex)
        {
            if (batch.metadata != null)
            {
                DWREngine._abortRequest(batch);
            }
            else if (DWREngine._errorHandler)
            {
                DWREngine._errorHandler(ex);
            }
        }

        DWREngine._finalize(batch);
    }
};

/**
 * Hack a polymorphic dwrSerialize() function on all basic types. Yeulch
 * @see DWREngine._addSerializeFunctions
 * @private
 */
DWREngine._addSerializeFunctions = function()
{
    Object.prototype.dwrSerialize = DWREngine._serializeObject;
    Array.prototype.dwrSerialize = DWREngine._serializeArray;
    Boolean.prototype.dwrSerialize = DWREngine._serializeBoolean;
    Number.prototype.dwrSerialize = DWREngine._serializeNumber;
    String.prototype.dwrSerialize = DWREngine._serializeString;
    Date.prototype.dwrSerialize = DWREngine._serializeDate;
};

/**
 * Remove the hacked polymorphic dwrSerialize() function on all basic types.
 * @see DWREngine._removeSerializeFunctions
 * @private
 */
DWREngine._removeSerializeFunctions = function()
{
    delete Object.prototype.dwrSerialize;
    delete Array.prototype.dwrSerialize;
    delete Boolean.prototype.dwrSerialize;
    delete Number.prototype.dwrSerialize;
    delete String.prototype.dwrSerialize;
    delete Date.prototype.dwrSerialize;
};

/**
 * Marshall a data item
 * @param batch A map of variables to how they have been marshalled
 * @param referto An array of already marshalled variables to prevent recurrsion
 * @param data The data to be marshalled
 * @param name The name of the data being marshalled
 * @private
 */
DWREngine._serializeAll = function(batch, referto, data, name)
{
    if (data == null)
    {
        batch.map[name] = "null:null";
        return;
    }

    switch (typeof data)
    {
    case "boolean":
        batch.map[name] = "boolean:" + data;
        break;

    case "number":
        batch.map[name] = "number:" + data;
        break;

    case "string":
        batch.map[name] = "string:" + encodeURIComponent(data);
        break;

    case "object":
        if (data.dwrSerialize)
        {
            batch.map[name] = data.dwrSerialize(batch, referto, data, name);
        }
        else
        {
            if (DWREngine._warningHandler)
            {
                DWREngine._warningHandler("Object without dwrSerialize: " + typeof data + ", attempting default converter.");
            }
            batch.map[name] = "default:" + data;
        }
        break;

    case "function":
        // We just ignore functions.
        break;

    default:
        if (DWREngine._warningHandler)
        {
            DWREngine._warningHandler("Unexpected type: " + typeof data + ", attempting default converter.");
        }
        batch.map[name] = "default:" + data;
        break;
    }
};

/**
 * This is for the types that can recurse so we need to check that we've not
 * marshalled this object before.
 * We'd like to do:
 *   var lookup = referto[data];
 * However hashmaps in Javascript appear to use the hash values of the *string*
 * versions of the objects used as keys so all objects count as the same thing.
 * So we need to have referto as an array and go through it sequentially
 * checking for equality with data
 * @private
 */
DWREngine._lookup = function(referto, data, name)
{
    var lookup;
    for (var i = 0; i < referto.length; i++)
    {
        if (referto[i].data == data)
        {
            lookup = referto[i];
            break;
        }
    }

    if (lookup)
    {
        return "reference:" + lookup.name;
    }

    referto.push({ data:data, name:name });
    return null;
};

/**
 * Marshall an object
 * @private
 * @see DWREngine._serializeAll()
 */
DWREngine._serializeObject = function(batch, referto, data, name)
{
    var ref = DWREngine._lookup(referto, this, name);
    if (ref)
    {
        return ref;
    }

    // treat objects as an associative arrays
    var reply = "Object:{";
    var element;
    for (element in this)
    {
        if (element != "dwrSerialize")
        {
            batch.paramCount++;
            var childName = "c" + DWREngine._batch.map.callCount + "-e" + batch.paramCount;
            DWREngine._serializeAll(batch, referto, this[element], childName);

            reply += encodeURIComponent(element);
            reply += ":reference:";
            reply += childName;
            reply += ", ";
        }
    }
    reply = reply.substring(0, reply.length - 2);
    reply += "}";

    return reply;
};

/**
 * Marshall an array
 * @private
 * @see DWREngine._serializeAll()
 */
DWREngine._serializeArray = function(batch, referto, data, name)
{
    var ref = DWREngine._lookup(referto, this, name);
    if (ref)
    {
        return ref;
    }

    var reply = "Array:[";
    for (var i = 0; i < this.length; i++)
    {
        if (i != 0)
        {
            reply += ",";
        }

        batch.paramCount++;
        var childName = "c" + DWREngine._batch.map.callCount + "-e" + batch.paramCount;
        DWREngine._serializeAll(batch, referto, this[i], childName);
        reply += "reference:";
        reply += childName;
    }
    reply += "]";

    return reply;
};

/**
 * Marshall a Boolean
 * @private
 * @see DWREngine._serializeAll()
 */
DWREngine._serializeBoolean = function(batch, referto, data, name)
{
    return "Boolean:" + this;
};

/**
 * Marshall a Number
 * @private
 * @see DWREngine._serializeAll()
 */
DWREngine._serializeNumber = function(batch, referto, data, name)
{
    return "Number:" + this;
};

/**
 * Marshall a String
 * @private
 * @see DWREngine._serializeAll()
 */
DWREngine._serializeString = function(batch, referto, data, name)
{
    return "String:" + encodeURIComponent(this);
};

/**
 * Marshall a Date
 * @private
 * @see DWREngine._serializeAll()
 */
DWREngine._serializeDate = function(batch, referto, data, name)
{
    return "Date:[ " +
        this.getUTCFullYear() + ", " +
        this.getUTCMonth() + ", " +
        this.getUTCDate() + ", " +
        this.getUTCHours() + ", " +
        this.getUTCMinutes() + ", " +
        this.getUTCSeconds() + ", " +
        this.getUTCMilliseconds() + "]";
};

/**
 * Convert an XML string into a DOC object.
 * @param xml The xml string
 * @return a DOM version of the xml string 
 * @private
 */
DWREngine._unserializeDocument = function(xml)
{
    var parser = new DOMParser();
    var dom = parser.parseFromString(xml, "text/xml");

    if (!dom.documentElement || dom.documentElement.tagName == "parsererror")
    {
        var message = dom.documentElement.firstChild.data;
        message += "\n" + dom.documentElement.firstChild.nextSibling.firstChild.data;
        throw message;
    }

    return dom;
};

/**
 * Inform the users that the function they just called is deprecated.
 * @deprecated
 * @private
 */
DWREngine._deprecated = function()
{
    if (DWREngine._warningHandler)
    {
        DWREngine._warningHandler("dwrXxx() functions are deprecated. Please convert to DWREngine.xxx()");
    }
};

/**
 * Stores the encrypted Key created by createClientAuthenticationKey() function
*/
DWREngine.clientAuthenticationKey = "";

DWREngine._authenticationFailureHandler = DWREngine.defaultMessageHandler;
DWREngine._sessionAuthenticationFailureHandler = DWREngine.defaultMessageHandler;
DWREngine._httpRequestMethodDenied = DWREngine.defaultMessageHandler;

DWREngine.setClientAuthenticationKey = function(value)
{
	DWREngine.clientAuthenticationKey = value;
};

DWREngine.setAuthenticationFailureHandler = function(handler)
{
    DWREngine._authenticationFailureHandler = handler;
};

DWREngine.setSessionAuthenticationFailureHandler = function(handler)
{
    DWREngine._sessionAuthenticationFailureHandler = handler;
};

DWREngine.setHttpRequestMethodDeniedHandler = function(handler)
{
    DWREngine._httpRequestMethodDenied = handler;
};

