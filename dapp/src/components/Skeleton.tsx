import React from "react"
import {
  Skeleton as ChakraSkeleton,
  SkeletonProps as ChakraSkeletonProps,
} from "@chakra-ui/react"

export default function Skeleton({ ...skeletonProps }: ChakraSkeletonProps) {
  return <ChakraSkeleton speed={0.4} {...skeletonProps} />
}
