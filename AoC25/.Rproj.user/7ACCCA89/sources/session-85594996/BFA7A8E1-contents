library(tidyverse)

ip <- get_input(2025, 2)

ip <- c("11-22,95-115,998-1012,1188511880-1188511890,222220-222224,1698522-1698528,446443-446449,38593856-38593862,565653-565659,824824821-824824827,2121212118-2121212124")

ip <- str_split_1(ip, ",")

## PArt 1

iid <- 0

for (i in 1:length(ip)){
  
  for (r in str_extract(ip[i], "[:digit:]+(?=-)"):str_extract(ip[i], "(?<=-)[:digit:]+")){
    
    if (str_length(r) %% 2 == 0){
      
      if (str_sub(r, start = 1, end = (str_length(r)/2)) == str_sub(r, start = (str_length(r)/2)+1, end = str_length(r))){
        iid <- iid + r
      }
    }
    
  }
  
}

## PArt 2

split_string_every_n <- function(text, n) {
  len <- nchar(text)
  starts <- seq(1, len, by = n)
  ends <- pmin(starts + n - 1, len)
  substring(text, starts, ends)
}

iid <- 0

for (i in 1:length(ip)){
  
  for (r in str_extract(ip[i], "[:digit:]+(?=-)"):str_extract(ip[i], "(?<=-)[:digit:]+")){
    
    for (s in 2:str_length(r)){
      
      if (split_string_every_n(r, str_length(r)/s) %>% unique() %>% length() == 1 & str_length(r) > 1){
        
        print(r)
        iid <- c(iid,r)
        break
        
      }
      
    }
    
  }
  
}


iid %>% unique() %>% length()
iid %>% unique() %>% sum()
