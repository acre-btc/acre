import React from "react"
import { Box, Stack, StackProps, useToken } from "@chakra-ui/react"
import { useSize } from "@chakra-ui/react-use-size"
import { AnimatePresence, Transition, Variants, motion } from "framer-motion"
import { usePagination } from "#/hooks"

const transition: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 16,
  mass: 0.85,
}

const variants: Variants = {
  enter: ({ direction, spacing }) => ({
    x: `calc((100% + ${spacing}) * ${direction === "right" ? 1 : -1})`,
    transition,
  }),
  center: {
    x: 0,
    transition,
  },
  exit: ({ direction, spacing }) => ({
    x: `calc((100% + ${spacing}) * ${direction === "left" ? 1 : -1})`,
    transition,
  }),
}

type PaginationPageProps<T> = Omit<StackProps, "children"> & {
  children: (pageData: T[]) => React.ReactNode
  pageSpacing?: number | string
}

function PaginationPage<T>(props: PaginationPageProps<T>) {
  const { children, pageSpacing = 0, ...restProps } = props
  const { page, pageData } = usePagination()

  const ref = React.useRef<HTMLDivElement>(null)
  const { height } = useSize(ref) ?? { height: 0 }

  const previousPage = React.useRef<number>(0)
  React.useEffect(() => {
    previousPage.current = page
  }, [page])

  const direction = page < previousPage.current ? "left" : "right"
  const spacing = useToken("space", pageSpacing, "20%")

  return (
    <Box as={motion.div} layout animate={{ height, transition }}>
      <Box ref={ref}>
        <AnimatePresence
          mode="popLayout"
          custom={{ direction, spacing }}
          initial={false}
        >
          <Stack
            as={motion.div}
            custom={{ direction, spacing }}
            key={page}
            variants={variants}
            animate="center"
            initial="enter"
            exit="exit"
            {...restProps}
          >
            {children(pageData as T[])}
          </Stack>
        </AnimatePresence>
      </Box>
    </Box>
  )
}

export default PaginationPage
