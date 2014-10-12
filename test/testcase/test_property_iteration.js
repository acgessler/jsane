// Test to verify the extra property that JSane adds
// to objects to trace them does not change observable
// behaviour.

// Name of the extra property that is added to each object.
//
// This needs to be kept in sync with src/runtime.js
var trace_id_prop_name = '___jsane_trace_id';

var o = {
	foo : 2,
	baz : 0,
};

// Trigger tracing by placing at least one null/undefined field
o.bar = null;
delete o.foo;
	
// These are the cases in which JSane needs to proxy the original
// functionality to hide the newly added non-numerable property.
expect(trace_id_prop_name in o).to.equal(false);
expect(o.hasOwnProperty(trace_id_prop_name)).to.equal(false);
expect(Object.getOwnPropertyNames(o).indexOf(trace_id_prop_name)).to.equal(-1);

// These are safe since they naturally ignore non-enumerable properties,
// but we should still check them.
expect(o.propertyIsEnumerable(trace_id_prop_name)).to.equal(false);
expect(Object.keys(o).indexOf(trace_id_prop_name)).to.equal(-1);

var i = 0;
for (k in o) {
	if (!o.hasOwnProperty(k)) {
		continue;
	}
	++i;
}

expect(i).to.equal(2);
