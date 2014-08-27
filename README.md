jsane
=====

Adding sanity checks and data tracing to your JavaScript code. Experimental and work in progress.

[![Build Status](https://travis-ci.org/acgessler/jsane.svg?branch=master)](https://travis-ci.org/acgessler/jsane)

Instead of 

`Cannot call undefined`

     Cannot call f() because f is undefined. History:
       f = this.some_other      at myfile:46
       this.some_other = foo    at myfile:22
       new Bar(foo = null)      at myfile:1324
       
##Usage

TODO


##Runtime checks

This is a non-exhaustive list of all checks that JSane provides. Most of these include data traces in their diagnostics, making it easier to narrow down the root cause of a suspected bug.

 - `W0`: An arithmetic expression propagates a non-numeric or non-finite operand value to its result, for example `undefined * 2` yields `NaN`
 - `W1`: An arithmetic expression is invoked with a non-numeric or non-finite operand, but its result is a valid number, hiding a potential bug. For example `2 + null` yields `2`
 - `E2`: A non-callable object is called, for example `var a = undefined; a();`. 

### Disabling checks

Disable for a single line of code

     // JSane: ignore
     ... this line is not checked
     ... this is checked again```
      
Or for a whole block

     // JSane: off
     
        ... all of this is non-checked
     
     // JSane: on
     ... this is checked again```
