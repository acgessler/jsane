// Test to verify that loading the runtime is as isolated as possible
// and does not accidentally alter global state.

var old_global_keys = Object.keys(global);
var rt_default_name = '__rt';

// Test runner embeds runtime source code here. |exports| undefined
// to have it populate global.__rt instead.
(function(exports) {
	INSERT_RUNTIME_HERE
})();

// Verify no new global keys expect __rt are introduced
var new_global_keys = Object.keys(global);

var rt_key_idx = new_global_keys.indexOf(rt_default_name);
expect(rt_key_idx).to.not.equal(-1);
new_global_keys.splice(rt_key_idx, 1);

expect(old_global_keys).to.be.eql(new_global_keys);

// verify __rt itself only exposes a whitelist of APIs
var rt = global[rt_default_name];

var whitelist = [
	'info',
	'setPrintFunc',
	'chkArith',
	'chkCall',
	'assign',
	'enterFunc',
	'leaveFunc',
	'proxyInOperator',
	'undo',
];

expect(Object.keys(rt)).to.be.eql(whitelist);
// TODO: verify Object, Function prototypes against a whitelist of patched functions

