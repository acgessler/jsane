// W6: Too many arguments passed to function

function f1(a, b, c) {

}

var f2 = function(a, b, c) {

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
">>";