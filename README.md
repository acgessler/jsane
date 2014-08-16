jsane
=====

Adding sanity checks and data tracing to your JavaScript code.

Instead of 

`Cannot call undefined`

     Cannot call f() because f is undefined. History:
       f = this.some_other      at myfile:46
       this.some_other = foo    at myfile:22
       new Bar(foo = null)      at myfile:1324
