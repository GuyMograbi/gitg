# gitg

> exposes commands gitg and gitg-alias to help you with git branches navigation

# gitg command

```

print current branch

    gitg .

show recent branches used. (simply gitg without any parameter)

   gitg

checkout last branch (just like git checkout -)


   gitg -

 checkout searching recently used branches

   gitg --

 checkout while fuzzy searching (will fall back to interactive search if multiple options)

    gitg some_name

checkout with interatice search (find)

   gitg -f

print all repo roots you visited

   gitg @


```

# gitg-alias command

```
gitg-alias name

  Will output the alias value for name

gitg-alias name value

  Will insert new entry or override existing one

gitg-alias <empty>

  Will list all existing aliases

gitg-alias --help

gitg-alias --open

  Opens the .gitg config file to edit aliases

gitg-alias --version
```



TODO

Add better branch history

```
for-each-ref --sort=-committerdate --count=15 refs/heads/ --format='%(HEAD) %(color:yellow)%(refname:short)%(color:reset) - %(color:red)%(objectname:short)%(color:reset) - %(contents:subject) - %(authorname) (%(color:green)%(committerdate:relative)%(color:reset))'
```
