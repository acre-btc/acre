import React from "react"
import { PaginationContext } from "#/contexts"
import { StackProps, VStack } from "@chakra-ui/react"

export type PaginationProps<T> = Omit<StackProps, "as"> & {
  data: T[]
  pageSize?: number
  defaultPage?: number
}

function Pagination<T>(props: PaginationProps<T>) {
  const { data, children, pageSize = 10, defaultPage = 0, ...restProps } = props

  const [page, setPage] = React.useState(defaultPage)

  const pageData = React.useMemo(() => {
    const startIndex = page * pageSize
    const endIndex = startIndex + pageSize

    return data.slice(startIndex, endIndex)
  }, [data, page, pageSize])

  const contextValue = React.useMemo(
    () => ({
      pageSize,
      page,
      setPage,
      totalSize: data.length,
      pageData,
    }),
    [pageSize, page, data, pageData],
  )

  return (
    <PaginationContext.Provider value={contextValue}>
      <VStack align="stretch" w="full" {...restProps}>
        {children}
      </VStack>
    </PaginationContext.Provider>
  )
}

export default Pagination
