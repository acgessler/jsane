// W6: Too many arguments passed to function

function f1(a, b, c) {

}

var f2 = function(a, b, c) {

};

var f3 = function() {
	if (false) {
		f2(arguments);
	}
};

"<<[expect=W6,W6]";
f1(1,2,3,4);
f2(1,2,3,4);
">>";

"<<[expect=]";
f1(1,2,3);
f2(1,2,3);
f1(1,2,3,undefined);
f2(1,2,3,undefined);

// A function that uses |arguments| in its body should not be checked
f3();
f3(1);

// Native functions should not be checked either
console.log(1);

// Nor should native type constructors
Array(1, 2, 3, 4, 5, 6, 7, 8, 9);

">>";

