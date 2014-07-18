var a = 2;
var b1 = null;
var b2 = true;
var b3 = false;

// This should cause a warning since |2 + null| === 2
var c1 = a + b1;

// This should cause a warning since |2 + true| === 3
var c2 = a + b2;

// This should cause a warning since |2 + false| === 2
var c2 = a + b3;
